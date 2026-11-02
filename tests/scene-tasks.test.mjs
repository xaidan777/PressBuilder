import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {sceneTaskStore} from '../server/scene-tasks.mjs';

function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'pressbuilder-scene-tasks-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const deck={slides:[{id:'s01',label:'Intro'},{id:'s02',label:'Outro'}]};
  const getDeck=id=>{
    if(id!=='demo')throw Object.assign(new Error('Unknown project'),{status:404});
    return deck;
  };
  return {root,store:sceneTaskStore({root,getDeck}),getDeck};
}

test('assignments and checkpoints stay isolated from the deck and other scenes',t=>{
  const {root,store,getDeck}=fixture(t);
  assert.deepEqual(store.list('demo').map(x=>x.revision),[0,0]);
  const first=store.put('demo','s01',{
    title:'3D intro',assignee:'agent-01',brief:'Animate the opening shot',
    status:'in_progress',checkpoints:[
      {id:'model',title:'Model is ready',done:false,note:''},
      {id:'render',title:'Review output frames',done:false,note:''}
    ]
  },0);
  assert.equal(first.revision,1);
  assert.equal(first.checkpoints.length,2);
  const second=store.put('demo','s02',{title:'Closing shot',status:'todo'},0);
  assert.equal(second.revision,1);
  const done=store.checkpoint('demo','s01','model',{done:true,note:'Geometry reviewed'},1);
  assert.equal(done.revision,2);
  assert.equal(done.checkpoints[0].done,true);
  assert.equal(store.read('demo','s02').revision,1);
  assert.equal(store.read('demo','s02').checkpoints.length,0);
  assert.equal(getDeck('demo').slides[0].label,'Intro');
  const file=path.join(root,'demo','.scene-tasks','s01.json');
  assert.ok(fs.existsSync(file));
  assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).checkpoints[0].note,'Geometry reviewed');
  assert.deepEqual(fs.readdirSync(path.dirname(file)).filter(s=>s.endsWith('.tmp')),[]);
  assert.equal(sceneTaskStore({root,getDeck}).read('demo','s01').revision,2);
});

test('stale editors cannot discard checkpoint updates',t=>{
  const {store}=fixture(t);
  store.put('demo','s01',{checkpoints:[{id:'qa',title:'Review',done:false,note:''}]},0);
  store.checkpoint('demo','s01','qa',{done:true,note:'Passed'},1);
  assert.throws(()=>store.put('demo','s01',{title:'Stale write'},1),{status:409});
  assert.throws(()=>store.checkpoint('demo','s01','qa',{done:false},1),{status:409});
  assert.throws(()=>store.checkpoint('demo','s01','qa',{done:false}),{status:409});
  assert.equal(store.read('demo','s01').checkpoints[0].done,true);
});

test('rejects traversal, unknown fields, duplicate IDs and invalid revisions',t=>{
  const {store}=fixture(t);
  for(const id of ['../outside','S01','x/y']) {
    assert.throws(()=>store.read('demo',id),{status:400});
  }
  assert.throws(()=>store.list('../outside'),{status:400});
  assert.throws(()=>store.read('demo','s03'),{status:404});
  assert.throws(()=>store.put('demo','s01',{status:'finished'},0),{status:400});
  assert.throws(()=>store.put('demo','s01',{scene_id:'bad'},0),{status:400});
  assert.throws(()=>store.put('demo','s01',{title:'Bad'},-1),{status:409});
  assert.throws(()=>store.put('demo','s01',{
    checkpoints:[{id:'same',title:'One'},{id:'same',title:'Two'}]
  },0),{status:400});
  assert.throws(()=>store.put('demo','s01',{brief:'x'.repeat(20_001)},0),{status:400});
  assert.equal(store.read('demo','s01').revision,0);
});

test('checkpoint writes validate payload, protect independent agent notes',t=>{
  const {store}=fixture(t);
  store.put('demo','s01',{checkpoints:[
    {id:'art',title:'Artwork',done:false,note:''},
    {id:'sound',title:'Mix',done:false,note:''}
  ]},0);
  store.checkpoint('demo','s01','art',{done:true,note:'Visual approved'},1);
  assert.throws(()=>store.checkpoint('demo','s01','sound',{done:true,note:'Stale note'},1),{status:409});
  store.checkpoint('demo','s01','sound',{done:true,note:'Audio approved'},2);
  const c=store.read('demo','s01').checkpoints;
  assert.deepEqual(c.map(x=>x.note),['Visual approved','Audio approved']);
  assert.throws(()=>store.checkpoint('demo','s01','sound',{done:'yes'},3),{status:400});
  assert.throws(()=>store.checkpoint('demo','s01','art',{unknown:1},3),{status:400});
  assert.throws(()=>store.checkpoint('demo','s01','missing',{done:true},3),{status:404});
});

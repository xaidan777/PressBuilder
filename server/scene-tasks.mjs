/**
 * Per-scene production assignments. Stored outside deck.json so independent
 * scene agents do not overwrite each other's checkpoint updates.
 * This module is independent of the renderer and integrates with the local Vite API.
 */
import fs from 'node:fs';
import path from 'node:path';

const SLUG=/^[a-z0-9][a-z0-9_-]{0,40}$/;
const CHECK_ID=/^[a-zA-Z0-9_-]{1,50}$/;
const STATES=new Set(['todo','in_progress','review','done','blocked']);
const MAX_CHECKPOINTS=60;

export function sceneTaskStore({root,getDeck,seedRoot}) {
  function locate(deckId,slideId) {
    if(typeof deckId!=='string'||typeof slideId!=='string'||!SLUG.test(deckId)||!SLUG.test(slideId))throw Object.assign(new Error('Invalid deck or scene ID'),{status:400});
    const deck=getDeck(deckId);
    const scene=deck?.slides?.find(s=>s.id===slideId);
    if(!scene)throw Object.assign(new Error('Scene not found'),{status:404});
    return {deck,scene,file:path.join(root,deckId,'.scene-tasks',slideId+'.json'),
      seedFile:seedRoot?path.join(seedRoot,deckId,'.scene-tasks',slideId+'.json'):null};
  }
  function fallback(scene) {
    return {scene_id:scene.id,title:String(scene.label||scene.id),assignee:'',status:'todo',
      brief:'',deliverables:'',checkpoints:[],revision:0,updated_at:null};
  }
  function read(deckId,slideId) {
    const {scene,file,seedFile}=locate(deckId,slideId);
    const source=fs.existsSync(file)?file:(seedFile&&fs.existsSync(seedFile)?seedFile:null);
    if(!source)return fallback(scene);
    try {
      const t=JSON.parse(fs.readFileSync(source,'utf8'));
      return {...fallback(scene),...t,scene_id:scene.id};
    }catch{throw Object.assign(new Error('Scene assignment cannot be read'),{status:500})}
  }
  function list(deckId) {
    if(typeof deckId!=='string'||!SLUG.test(deckId))bad('Invalid project ID');
    const d=getDeck(deckId);
    if(!d||!Array.isArray(d.slides))throw Object.assign(new Error('Project not found'),{status:404});
    return d.slides.map(s=>read(deckId,s.id));
  }
  function bad(message) {throw Object.assign(new Error(message),{status:400})}
  function str(x,key,max) {
    if(typeof x!=='string'||x.length>max)bad('Invalid '+key+' (max '+max+' characters)');
    return x.trim();
  }
  function checkList(arr) {
    if(!Array.isArray(arr)||arr.length>MAX_CHECKPOINTS)bad('Invalid checkpoints (max '+MAX_CHECKPOINTS+')');
    const ids=new Set();
    return arr.map((c,i)=>{
      if(!c||typeof c!=='object'||Array.isArray(c))bad('Invalid checkpoint');
      const id=c.id===undefined?'cp'+String(i+1).padStart(2,'0'):c.id;
      if(typeof id!=='string'||!CHECK_ID.test(id)||ids.has(id))bad('Invalid or duplicate checkpoint ID');
      ids.add(id);
      const title=str(c.title,'checkpoint title',260);
      if(!title)bad('Checkpoint title is required');
      if(c.done!==undefined&&typeof c.done!=='boolean')bad('Checkpoint done must be boolean');
      const note=c.note===undefined?'':str(c.note,'checkpoint note',1000);
      return {id,title,done:c.done===true,note};
    });
  }
  function write(file,task) {
    fs.mkdirSync(path.dirname(file),{recursive:true});
    // Atomic replacement. A revision check protects against stale editor saves.
    const temp=file+'.'+process.pid+'.'+Math.random().toString(36).slice(2)+'.tmp';
    fs.writeFileSync(temp,JSON.stringify(task,null,2)+'\n',{mode:0o600});
    try{fs.renameSync(temp,file)}finally{fs.rmSync(temp,{force:true})}
  }
  function put(deckId,slideId,fields,expectedRevision) {
    const {file}=locate(deckId,slideId);
    const old=read(deckId,slideId);
    if(typeof expectedRevision!=='number'||!Number.isSafeInteger(expectedRevision)||expectedRevision!==old.revision)
      throw Object.assign(new Error('Scene assignment changed; reload and retry'),{status:409});
    if(!fields||typeof fields!=='object'||Array.isArray(fields))bad('Invalid assignment');
    const allowed=new Set(['title','assignee','status','brief','deliverables','checkpoints']);
    for(const k of Object.keys(fields))if(!allowed.has(k))bad('Unknown assignment field: '+k);
    const next={...old};
    for(const [k,max] of [['title',180],['assignee',150],['brief',20000],['deliverables',10000]]){
      if(fields[k]!==undefined)next[k]=str(fields[k],k,max);
    }
    if(fields.status!==undefined){
      if(!STATES.has(fields.status))bad('Invalid scene status');
      next.status=fields.status;
    }
    if(fields.checkpoints!==undefined)next.checkpoints=checkList(fields.checkpoints);
    next.revision=old.revision+1;
    next.updated_at=new Date().toISOString();
    write(file,next);
    return next;
  }
  function checkpoint(deckId,slideId,checkpointId,patch,expectedRevision) {
    const {file}=locate(deckId,slideId);
    if(typeof checkpointId!=='string'||!CHECK_ID.test(checkpointId))bad('Invalid checkpoint ID');
    const old=read(deckId,slideId);
    // A checkpoint update is a full-file write. Reject stale callers to avoid
    // silently losing another editor's completed work.
    if(!Number.isSafeInteger(expectedRevision)||expectedRevision!==old.revision)
      throw Object.assign(new Error('Scene assignment changed; reload and retry'),{status:409});
    const checkpoints=old.checkpoints.map(c=>({...c}));
    const c=checkpoints.find(c=>c.id===checkpointId);
    if(!c)throw Object.assign(new Error('Checkpoint not found'),{status:404});
    if(!patch||typeof patch!=='object'||Array.isArray(patch))bad('Invalid checkpoint update');
    for(const k of Object.keys(patch))if(!['done','note'].includes(k))bad('Unknown checkpoint field: '+k);
    if(patch.done!==undefined){if(typeof patch.done!=='boolean')bad('done must be boolean');c.done=patch.done}
    if(patch.note!==undefined)c.note=str(patch.note,'checkpoint note',1000);
    const next={...old,checkpoints,revision:old.revision+1,updated_at:new Date().toISOString()};
    write(file,next);
    return next;
  }
  return {read,list,put,checkpoint};
}

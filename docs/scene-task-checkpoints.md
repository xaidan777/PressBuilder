# Independent scene tasks and checkpoints

This adds per-scene production assignments to the existing **local Vite editor server**.
An editor or agent can read a complete assignment, assign a scene and record review
checkpoints without rewriting `deck.json` or another agent's scene task.

Each assignment lives in `src/decks/<deck-id>/.scene-tasks/<scene-id>.json`.
When a project has no saved assignment, GET returns a read-only default with revision `0`.
The first PUT creates the file; it does **not** modify the deck or scene code.

## HTTP API

Start the normal development server (`npm run dev`), then use:

| Operation | Method | Path |
| --- | --- | --- |
| List assignments | GET | `/api/decks/:id/tasks` |
| Read one scene | GET | `/api/decks/:id/tasks/:sceneId` |
| Save task (compare-and-swap) | PUT | `/api/decks/:id/tasks/:sceneId` |
| Check off a checkpoint | PATCH | `/api/decks/:id/tasks/:sceneId/checkpoints/:checkpointId` |

Both PUT and PATCH require the last `revision` from a GET, preventing a stale editor
from overwriting another agent's work:

```json
{
  "expected_revision": 0,
  "title": "3D opening",
  "assignee": "agent-01",
  "status": "in_progress",
  "brief": "Animate the title and camera",
  "deliverables": "Approved preview and exported MP4",
  "checkpoints": [
    {"id": "geometry", "title": "Geometry and framing reviewed", "done": false, "note": ""},
    {"id": "preview", "title": "Frame preview approved", "done": false, "note": ""}
  ]
}
```

After a preview review, PATCH with:

```json
{"expected_revision": 1, "done": true, "note": "Reviewed title legibility at 1080p"}
```

A successful write returns the new revision. If the provided revision is stale,
PUT or PATCH returns HTTP `409`; re-read the task before retrying. IDs and field lengths
are validated, duplicate checkpoint IDs are rejected, and request bodies on these
endpoints are limited to 128 KiB. Checkpoint changes are stored atomically.

## Scope and limitations

- This is a backend capability for the existing local editor, **not** a cloud service.
- It does not dispatch or run agents; clients must coordinate assignment ownership.
- Optimistic revision checks protect clients of **one local Vite process**; they are not
  distributed locks across multiple independent server processes or shared-network mounts.
- It does not claim that checking a box proves a render was reviewed: attach evidence
  to the checkpoint note and require a human or independent QA gate before release.
- The existing editor UI is unchanged; a scene-task panel can be a follow-up PR.
- Do not expose the Vite dev server directly to an untrusted network: like the
  original project, these local endpoints do not implement authentication.

## Verification

```bash
node --test tests/scene-tasks.test.mjs tests/scene-tasks-http.test.mjs
npm run typecheck
```

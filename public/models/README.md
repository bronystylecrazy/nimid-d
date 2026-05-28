Place optional arm meshes here:

- `arms.glb` - preferred. Use this for a combined first-person arms model
  such as WRAD ARMS.
- `human-arms.glb` - also supported.

Fallback per-side files are also supported:

- `human-arm-left.glb`
- `human-arm-right.glb`

The shake scene loads `arms.glb` first, then `human-arms.glb`. If both are
missing, it tries the left/right files. When a model is present, the procedural
cylinder fallback is hidden and the imported arm root follows the cup wrist
target.

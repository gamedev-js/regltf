'use strict';

let lstats = new window.LStats(document.body);

const ddraw = window.ddraw;
const {utils} = window.sgraph;
const regltf = window.regltf;

// init global
let canvasEL = document.getElementById('canvas');
let shell = new ddraw.Shell(canvasEL);
let renderer = shell._renderer;
let regl = renderer._regl;

let nodes = [];
let scene = null;

regltf.load(regl, './assets_01/scene.gltf', (err, result) => {
  console.log(result);
  scene = result;

  // init scene
  scene.nodes.forEach(node => {
    let flats = utils.flat(node);
    nodes = nodes.concat(flats);
  });
});

// frame
shell.frame(() => {
  lstats.tick();

  if (scene) {
    nodes.forEach(node => {
      // renderer.drawNode(node);

      if (!node._meshes) {
        return;
      }

      node._meshes.forEach(id => {
        let gltfMesh = scene.json.meshes[id];
        gltfMesh.primitives.forEach(gltfPrimitive => {
          let data = regltf.buildCommandData(scene, node, gltfPrimitive);
          let cmd = scene.commands[data.techID];

          if (!cmd) {
            console.warn(`Can not find draw command for ${data.techID}`);
            return;
          }

          renderer.addCommand(cmd, data);
        });
      });
    });
  }
});
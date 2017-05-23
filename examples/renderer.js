'use strict';

// var SPECTOR = require('spectorjs');
// var spector = new SPECTOR.Spector();
// spector.displayUI();

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

function _buildNodes(scene) {
  let nodes = [];

  scene.nodes.forEach(node => {
    let flats = utils.flat(node);
    nodes = nodes.concat(flats);
  });

  return nodes;
}


let gltfPath = '/Users/johnny/jwu/gltf-exporter/Assets/gltf-exports/scene.gltf';
// let gltfPath = './assets_02/scene.gltf';
regltf.load(regl, gltfPath, (err, result) => {
  console.log(result);
  scene = result;

  // init scene
  nodes = _buildNodes(scene);
});

// frame
shell.frame(() => {
  regltf.reset();
  lstats.tick();

  if (scene) {
    if (scene._dirty) {
      nodes = _buildNodes(scene);
      scene._dirty = false;
    }

    nodes.forEach(node => {

      renderer.drawNode(node);

      if (!node._meshes) {
        return;
      }

      node._meshes.forEach(id => {
        let gltfMesh = scene.meshes[id];
        if (!gltfMesh) {
          // console.warn('mesh data not ready');
          return;
        }

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
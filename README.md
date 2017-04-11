## gl-stats

WebGL stats.

## Install

```bash
npm install gl-stats
```

## Usage

```javascript
let stats = new glstats(document.body);

function render() {
  stats.tick();
  requestAnimationFrame(render);
}

render();
```

## License

MIT © 2017 Johnny Wu
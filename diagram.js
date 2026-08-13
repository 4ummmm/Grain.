document.addEventListener('DOMContentLoaded', function() {
  const canvas = new fabric.Canvas('canvas');

// ---- Dotted background ----
function createDotsPattern() {
  const dotCanvas = document.createElement('canvas');
  dotCanvas.width = 20;
  dotCanvas.height = 20;
  const ctx = dotCanvas.getContext('2d');
  ctx.fillStyle = '#ddd';
  ctx.beginPath();
  ctx.arc(10, 10, 1.5, 0, 2 * Math.PI);
  ctx.fill();
  return new fabric.Pattern({
    source: dotCanvas,
    repeat: 'repeat'
  });
}
canvas.setBackgroundColor(createDotsPattern(), () => canvas.renderAll());

  // ---- Resize ----
  function resizeCanvas() {
    const panel = document.getElementById('panel1');
    canvas.setWidth(panel.clientWidth);
    canvas.setHeight(panel.clientHeight);
    canvas.renderAll();
  }
  window.addEventListener('resize', resizeCanvas);
  setTimeout(resizeCanvas, 100);

  // ---- Zoom ----
  let zoomLevel = 1;
  function zoom(factor) {
    zoomLevel = Math.min(5, Math.max(0.1, zoomLevel * factor));
    const center = canvas.getCenter();
    canvas.setViewportTransform([zoomLevel, 0, 0, zoomLevel, center.left - center.left * zoomLevel, center.top - center.top * zoomLevel]);
    canvas.renderAll();
  }
  document.getElementById('zoomIn').addEventListener('click', () => zoom(1.2));
  document.getElementById('zoomOut').addEventListener('click', () => zoom(0.8));
  document.getElementById('zoomReset').addEventListener('click', () => {
    zoomLevel = 1;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.renderAll();
  });

  // ---- Add Rectangle ----
  document.getElementById('addRect').addEventListener('click', () => {
    const rect = new fabric.Rect({
      left: 50, top: 50, width: 120, height: 80,
      fill: '#f0f0f0', stroke: '#333', strokeWidth: 2,
      selectable: true, hasControls: true, hasBorders: true,
    });
    const text = new fabric.Textbox('Double-click', {
      left: 50, top: 50, width: 120, fontSize: 16,
      textAlign: 'center', originX: 'left', originY: 'top',
      selectable: false, evented: false,
    });
    const group = new fabric.Group([rect, text], { left: 50, top: 50 });
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.renderAll();
  });

  // ---- Add Arrow ----
  document.getElementById('addArrow').addEventListener('click', () => {
    const line = new fabric.Line([50, 50, 200, 100], {
      stroke: '#333', strokeWidth: 3,
      selectable: true,
    });
    const head = new fabric.Triangle({
      left: 200, top: 100, width: 16, height: 16,
      fill: '#333', angle: 30,
      selectable: false, evented: false,
    });
    const group = new fabric.Group([line, head], { left: 0, top: 0 });
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.renderAll();
  });

  // ---- Delete ----
  document.getElementById('deleteSel').addEventListener('click', () => {
    const active = canvas.getActiveObject();
    if (active) { canvas.remove(active); canvas.renderAll(); }
  });

  // ---- Edit text on double-click ----
  canvas.on('mouse:dblclick', (e) => {
    const target = e.target;
    if (target && target.type === 'group') {
      const textObj = target.getObjects().find(o => o.type === 'textbox');
      if (textObj) {
        textObj.enterEditing();
        textObj.selectAll();
      }
    }
  });
});

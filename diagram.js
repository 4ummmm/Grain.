document.addEventListener('DOMContentLoaded', function () {
  const canvas = new fabric.Canvas('canvas', {
    selection: true,
    preserveObjectStacking: true,
  });

  // ---------- Dotted background ----------
  function createDotsPattern() {
    const dotCanvas = document.createElement('canvas');
    dotCanvas.width = 20;
    dotCanvas.height = 20;
    const ctx = dotCanvas.getContext('2d');
    ctx.fillStyle = '#ddd';
    ctx.beginPath();
    ctx.arc(10, 10, 1.5, 0, 2 * Math.PI);
    ctx.fill();
    return new fabric.Pattern({ source: dotCanvas, repeat: 'repeat' });
  }
  canvas.setBackgroundColor(createDotsPattern(), () => canvas.renderAll());

  // ---------- Resize canvas to fill panel ----------
  function resizeCanvas() {
    const panel = document.getElementById('panel1');
    canvas.setWidth(panel.clientWidth);
    canvas.setHeight(panel.clientHeight);
    canvas.renderAll();
  }
  window.addEventListener('resize', resizeCanvas);
  setTimeout(resizeCanvas, 100);

  // ---------- State ----------
  let nodeCounter = 0;
  let arrowCounter = 0;
  const nodes = {};   // id -> { id, rect, text, align }
  const arrows = {};  // id -> { id, fromId, toId, line, head }

  let connectMode = false;
  let connectFromId = null;

  // ---------- Node (rectangle + text) ----------
  function positionText(rect, text, align) {
    const padding = 10;
    if (align === 'top-left') {
      text.set({
        originX: 'left', originY: 'top', textAlign: 'left',
        left: rect.left + padding,
        top: rect.top + padding,
        width: Math.max(10, rect.width - padding * 2),
      });
    } else {
      text.set({
        originX: 'center', originY: 'center', textAlign: 'center',
        left: rect.left + rect.width / 2,
        top: rect.top + rect.height / 2,
        width: Math.max(10, rect.width - padding * 2),
      });
    }
    text.setCoords();
  }

  function addNode(left = 80, top = 80, width = 140, height = 80) {
    const id = 'n' + (++nodeCounter);

    const rect = new fabric.Rect({
      left, top, width, height,
      fill: '#f5f5f5', stroke: '#333', strokeWidth: 2,
      rx: 4, ry: 4,
      hasControls: true, hasBorders: true,
    });
    rect.data = { id, type: 'node' };

    const text = new fabric.Textbox('Text', {
      fontSize: 16, fill: '#222',
      selectable: false, evented: false,
    });
    text.data = { id, type: 'label' };

    const node = { id, rect, text, align: 'center' };
    nodes[id] = node;
    positionText(rect, text, node.align);

    canvas.add(rect, text);
    canvas.setActiveObject(rect);
    canvas.renderAll();
    return node;
  }

  // Keep text + connected arrows synced while dragging/resizing a node
  function syncNode(rect) {
    const node = nodes[rect.data.id];
    positionText(rect, node.text, node.align);
    updateArrowsFor(node.id);
  }

  canvas.on('object:moving', (e) => {
    if (e.target?.data?.type === 'node') syncNode(e.target);
  });

  canvas.on('object:scaling', (e) => {
    const rect = e.target;
    if (rect?.data?.type === 'node') {
      rect.set({
        width: Math.max(20, rect.width * rect.scaleX),
        height: Math.max(20, rect.height * rect.scaleY),
        scaleX: 1, scaleY: 1,
      });
      rect.setCoords();
      syncNode(rect);
    }
  });

  canvas.on('object:modified', (e) => {
    if (e.target?.data?.type === 'node') syncNode(e.target);
  });

  // ---------- Double-click to edit text ----------
  canvas.on('mouse:dblclick', (opt) => {
    const target = opt.target;
    if (target?.data?.type === 'node') {
      const node = nodes[target.data.id];
      const text = node.text;
      text.selectable = true;
      text.evented = true;
      canvas.setActiveObject(text);
      text.enterEditing();
      text.selectAll();
      canvas.renderAll();
    }
  });

  canvas.on('text:editing:exited', (opt) => {
    const text = opt.target;
    if (text?.data?.type === 'label') {
      text.selectable = false;
      text.evented = false;
      const node = nodes[text.data.id];
      positionText(node.rect, text, node.align);
      canvas.discardActiveObject();
      canvas.renderAll();
    }
  });

  // ---------- Arrows (one-way connectors between nodes) ----------
  function rectEdgePoint(rect, towardX, towardY) {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = towardX - cx;
    const dy = towardY - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    const scaleX = (rect.width / 2) / Math.abs(dx || 1e-6);
    const scaleY = (rect.height / 2) / Math.abs(dy || 1e-6);
    const scale = Math.min(scaleX, scaleY);
    return { x: cx + dx * scale, y: cy + dy * scale };
  }

  function updateArrow(arrow) {
    const from = nodes[arrow.fromId];
    const to = nodes[arrow.toId];
    if (!from || !to) return;
    const fromCenter = { x: from.rect.left + from.rect.width / 2, y: from.rect.top + from.rect.height / 2 };
    const toCenter = { x: to.rect.left + to.rect.width / 2, y: to.rect.top + to.rect.height / 2 };
    const start = rectEdgePoint(from.rect, toCenter.x, toCenter.y);
    const end = rectEdgePoint(to.rect, fromCenter.x, fromCenter.y);

    arrow.line.set({ x1: start.x, y1: start.y, x2: end.x, y2: end.y });
    arrow.line.setCoords();

    const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI + 90;
    arrow.head.set({ left: end.x, top: end.y, angle });
    arrow.head.setCoords();
  }

  function updateArrowsFor(nodeId) {
    Object.values(arrows).forEach((a) => {
      if (a.fromId === nodeId || a.toId === nodeId) updateArrow(a);
    });
    canvas.renderAll();
  }

  function addArrow(fromId, toId) {
    if (fromId === toId) return;
    const id = 'a' + (++arrowCounter);

    const line = new fabric.Line([0, 0, 0, 0], {
      stroke: '#333', strokeWidth: 2,
      selectable: true, hasControls: false, hasBorders: false,
      lockMovementX: true, lockMovementY: true,
    });
    line.data = { id, type: 'arrow' };

    const head = new fabric.Triangle({
      left: 0, top: 0, width: 12, height: 14,
      fill: '#333', selectable: false, evented: false,
      originX: 'center', originY: 'center',
    });
    head.data = { id, type: 'arrowhead' };

    const arrow = { id, fromId, toId, line, head };
    arrows[id] = arrow;
    canvas.add(line, head);
    updateArrow(arrow);
    canvas.renderAll();
    return arrow;
  }

  // ---------- Deletion ----------
  function deleteNode(id) {
    const node = nodes[id];
    if (!node) return;
    canvas.remove(node.rect, node.text);
    delete nodes[id];
    Object.values(arrows)
      .filter((a) => a.fromId === id || a.toId === id)
      .forEach((a) => deleteArrow(a.id));
  }

  function deleteArrow(id) {
    const arrow = arrows[id];
    if (!arrow) return;
    canvas.remove(arrow.line, arrow.head);
    delete arrows[id];
  }

  function deleteSelected() {
    const active = canvas.getActiveObject();
    if (!active?.data) return;
    if (active.data.type === 'node') deleteNode(active.data.id);
    else if (active.data.type === 'arrow') deleteArrow(active.data.id);
    canvas.discardActiveObject();
    canvas.renderAll();
  }

  document.getElementById('deleteSel').addEventListener('click', deleteSelected);
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
    if (canvas.getActiveObject()?.isEditing) return; // don't delete while typing text
    deleteSelected();
  });

  // ---------- Toolbar: Add rectangle ----------
  document.getElementById('addRect').addEventListener('click', () => {
    addNode(80 + Math.random() * 60, 80 + Math.random() * 60);
  });

  // ---------- Toolbar: Add arrow (click-to-connect mode) ----------
  const addArrowBtn = document.getElementById('addArrow');
  function setConnectMode(on) {
    connectMode = on;
    connectFromId = null;
    addArrowBtn.classList.toggle('active', on);
    canvas.defaultCursor = on ? 'crosshair' : 'default';
  }
  addArrowBtn.addEventListener('click', () => setConnectMode(!connectMode));

  canvas.on('mouse:down', (opt) => {
    if (!connectMode) return;
    const target = opt.target;
    if (target?.data?.type !== 'node') return;
    const id = target.data.id;
    if (!connectFromId) {
      connectFromId = id;
      target.set('stroke', '#1a73e8');
      canvas.renderAll();
    } else if (connectFromId !== id) {
      addArrow(connectFromId, id);
      nodes[connectFromId].rect.set('stroke', '#333');
      setConnectMode(false);
      canvas.renderAll();
    }
  });

  // ---------- Toolbar: Text alignment toggle ----------
  const alignBtn = document.getElementById('toggleAlign');
  if (alignBtn) {
    alignBtn.addEventListener('click', () => {
      const active = canvas.getActiveObject();
      if (active?.data?.type !== 'node') return;
      const node = nodes[active.data.id];
      node.align = node.align === 'center' ? 'top-left' : 'center';
      positionText(node.rect, node.text, node.align);
      canvas.renderAll();
    });
  }

  // ---------- Zoom: toolbar buttons ----------
  let zoomLevel = 1;
  function setZoom(z) {
    zoomLevel = Math.min(5, Math.max(0.1, z));
    canvas.setZoom(zoomLevel);
    canvas.renderAll();
  }
  document.getElementById('zoomIn').addEventListener('click', () => setZoom(zoomLevel * 1.2));
  document.getElementById('zoomOut').addEventListener('click', () => setZoom(zoomLevel * 0.8));
  document.getElementById('zoomReset').addEventListener('click', () => {
    zoomLevel = 1;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.renderAll();
  });

  // ---------- Zoom: mouse wheel, zoom toward cursor (draw.io style) ----------
  canvas.on('mouse:wheel', (opt) => {
    const delta = opt.e.deltaY;
    let zoom = canvas.getZoom();
    zoom *= 0.999 ** delta;
    zoom = Math.min(5, Math.max(0.1, zoom));
    canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
    zoomLevel = zoom;
    opt.e.preventDefault();
    opt.e.stopPropagation();
  });

  // ---------- Pan: hold Space + drag, or middle-mouse drag ----------
  let isPanning = false;
  let spaceDown = false;
  let lastPos = null;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !spaceDown) {
      spaceDown = true;
      canvas.defaultCursor = 'grab';
      canvas.renderAll();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      spaceDown = false;
      canvas.defaultCursor = 'default';
      canvas.renderAll();
    }
  });

  canvas.on('mouse:down', (opt) => {
    if (spaceDown || opt.e.button === 1) {
      isPanning = true;
      canvas.selection = false;
      lastPos = { x: opt.e.clientX, y: opt.e.clientY };
    }
  });
  canvas.on('mouse:move', (opt) => {
    if (!isPanning || !lastPos) return;
    const e = opt.e;
    const vpt = canvas.viewportTransform;
    vpt[4] += e.clientX - lastPos.x;
    vpt[5] += e.clientY - lastPos.y;
    canvas.requestRenderAll();
    lastPos = { x: e.clientX, y: e.clientY };
  });
  canvas.on('mouse:up', () => {
    isPanning = false;
    canvas.selection = true;
  });

  // ---------- Starter node ----------
  addNode(100, 100);
});

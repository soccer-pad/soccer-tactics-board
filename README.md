[style.css](https://github.com/user-attachments/files/32473607/style.css)
* { box-sizing: border-box; }

body {
  margin: 0;
  padding: 20px;
  background: #1b1f24;
  color: #eee;
  font-family: "Malgun Gothic", "Segoe UI", sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
}

h1 {
  margin: 0 0 16px 0;
  font-size: 24px;
}

/* ---- 전체 레이아웃: 필드(메인) + 사이드바(탭) ---- */
.app-shell {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  width: 100%;
  max-width: 1360px;
}

.stage {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.board-wrap {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  max-width: 100%;
}

canvas#board {
  display: block;
  cursor: grab;
  touch-action: none;
  max-width: 100%;
  height: auto;
}

.hint {
  margin-top: 10px;
  font-size: 13px;
  color: #999;
  text-align: center;
}

.sidebar {
  flex: 0 0 380px;
  width: 380px;
  background: #262b33;
  border-radius: 10px;
  padding: 12px;
  max-height: 700px;
  display: flex;
  flex-direction: column;
}

.tab-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  padding: 8px 2px;
  font-size: 12px;
  border-radius: 8px;
  text-align: center;
  background: #1f242b;
}

.tab-btn.active {
  background: #2e7d32;
  border-color: #2e7d32;
  color: #fff;
}

.tab-panels {
  overflow-y: auto;
  padding-right: 4px;
}

.tab-panel {
  display: none;
  flex-direction: column;
  gap: 10px;
}

.tab-panel.active {
  display: flex;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #bbb;
  font-weight: 600;
}

.panel-head.sub {
  margin-top: 6px;
  padding-top: 10px;
  border-top: 1px solid #333;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.group label {
  font-size: 12px;
  color: #aaa;
}

select, button, input[type="text"] {
  font-size: 14px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid #444;
  background: #3a4049;
  color: #eee;
}

button {
  cursor: pointer;
}

select:hover, button:hover {
  background: #464d58;
}

input[type="text"] {
  flex: 1;
  min-width: 0;
}

.accent {
  background: #2e7d32;
  border-color: #2e7d32;
  color: #fff;
}

.accent:hover {
  background: #379340;
}

.row-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.row-actions.wrap {
  flex-wrap: wrap;
}

#modeBtn.mode-move {
  background: #2e7d32;
  border-color: #2e7d32;
}

#modeBtn.mode-draw {
  background: #d84315;
  border-color: #d84315;
}

#gridToggleBtn.active {
  background: #00838f;
  border-color: #00838f;
  color: #fff;
}

.touch-ghost {
  position: fixed;
  left: 0;
  top: 0;
  transform: translate(-50%, -120%);
  background: #2e7d32;
  color: #fff;
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 13px;
  pointer-events: none;
  z-index: 9999;
  box-shadow: 0 3px 10px rgba(0,0,0,0.5);
  white-space: nowrap;
}

/* ---- 팀 패널 ---- */
.teams-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.team-row {
  background: #1f242b;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-left: 5px solid #888;
}

.team-row .team-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
}

.team-row .team-title .team-title-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.team-row .team-count {
  font-size: 12px;
  color: #aaa;
  font-weight: normal;
}

.team-del-btn {
  padding: 2px 7px;
  font-size: 12px;
  background: #4a2020;
  border-color: #6b2b2b;
}

.team-del-btn:hover {
  background: #6b2b2b;
}

.swatch-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.swatch {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}

.swatch.selected {
  border-color: #fff;
}

.team-row select {
  flex: 1;
}

.small-btn {
  padding: 4px 8px;
  font-size: 13px;
}

.total-count {
  font-size: 12px;
  color: #aaa;
}

.drag-handle {
  padding: 4px 10px;
  border-radius: 14px;
  font-size: 12px;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.6);
  cursor: grab;
  user-select: none;
  text-align: center;
}

.drag-handle:active {
  cursor: grabbing;
}

.equip-handle {
  display: inline-block;
  padding: 3px 9px;
  border: 1px dashed #666;
  border-radius: 6px;
  cursor: grab;
  user-select: none;
}

.equip-handle:active {
  cursor: grabbing;
}

/* ---- 용품 패널 ---- */
.equipment-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.equip-row {
  background: #1f242b;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.equip-row .equip-title {
  font-size: 13px;
  font-weight: 600;
}

.equip-row .row-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.goal-controls {
  background: #1f242b;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ---- 텍스트(설명) 패널 ---- */
.text-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.text-item {
  display: flex;
  gap: 6px;
  align-items: center;
  background: #1f242b;
  border-radius: 6px;
  padding: 6px;
}

.text-item input[type="text"] {
  flex: 1;
}

.empty-msg {
  font-size: 12px;
  color: #777;
  padding: 6px 0;
}

/* ---- 저장 패널 ---- */
.save-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 260px;
  overflow-y: auto;
}

.save-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  background: #1f242b;
  border-radius: 6px;
  padding: 8px;
}

.save-item .save-name {
  font-size: 13px;
  font-weight: 600;
}

.save-item .save-date {
  font-size: 11px;
  color: #888;
}

.save-item .save-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

@media (max-width: 900px) {
  .app-shell {
    flex-direction: column;
    align-items: stretch;
  }
  .sidebar {
    width: 100%;
    flex: 1 1 auto;
    max-height: none;
  }
}

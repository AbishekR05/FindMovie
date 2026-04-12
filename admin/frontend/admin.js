(function(){
  const apiInput = document.getElementById('apiUrl');
  const tokenInput = document.getElementById('adminToken');
  const loadBtn = document.getElementById('loadRooms');
  const roomsList = document.getElementById('roomsList');
  const messagesList = document.getElementById('messagesList');
  const currentRoom = document.getElementById('currentRoom');

  const defaultUrl = (window.ADMIN_API_URL || 'http://localhost:5000').replace(/\/$/, '');
  apiInput.value = defaultUrl;

  function setLoading(el, on=true) {
    if (on) el.classList.add('loading'); else el.classList.remove('loading');
  }

  async function fetchRooms() {
    const base = (apiInput.value || defaultUrl).replace(/\/$/, '');
    const token = tokenInput.value.trim();
    roomsList.innerHTML = '';
    messagesList.innerHTML = '';
    currentRoom.textContent = '';
    setLoading(roomsList, true);
    try {
      const q = token ? `?adminToken=${encodeURIComponent(token)}` : '';
      const res = await fetch(`${base}/api/admin/rooms${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data && data.error ? data.error : 'Failed to fetch rooms');
      renderRooms(data.rooms || []);
    } catch (err) {
      roomsList.innerHTML = `<div class="error">${String(err)}</div>`;
    } finally {
      setLoading(roomsList, false);
    }
  }

  function renderRooms(rooms) {
    if (!rooms || rooms.length === 0) {
      roomsList.innerHTML = '<div class="muted">No rooms</div>';
      return;
    }
    const ul = document.createElement('ul');
    ul.className = 'rooms-ul';
    rooms.forEach(r => {
      const li = document.createElement('li');
      li.className = 'room-item';
      li.innerHTML = `<div class="room-id">${r.roomId}</div><div class="room-meta">Users: ${r.users?.length || 0} • Messages: ${r.messagesCount || 0}</div>`;
      li.addEventListener('click', () => loadMessages(r.roomId));
      ul.appendChild(li);
    });
    roomsList.innerHTML = '';
    roomsList.appendChild(ul);
  }

  async function loadMessages(roomId) {
    const base = (apiInput.value || defaultUrl).replace(/\/$/, '');
    const token = tokenInput.value.trim();
    messagesList.innerHTML = '';
    currentRoom.textContent = `— ${roomId}`;
    setLoading(messagesList, true);
    try {
      const q = token ? `?adminToken=${encodeURIComponent(token)}` : '';
      const res = await fetch(`${base}/api/admin/rooms/${encodeURIComponent(roomId)}/messages${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data && data.error ? data.error : 'Failed to fetch messages');
      renderMessages(data.messages || []);
    } catch (err) {
      messagesList.innerHTML = `<div class="error">${String(err)}</div>`;
    } finally {
      setLoading(messagesList, false);
    }
  }

  function renderMessages(messages) {
    if (!messages || messages.length === 0) {
      messagesList.innerHTML = '<div class="muted">No messages</div>';
      return;
    }
    const container = document.createElement('div');
    container.className = 'msgs';
    messages.forEach(m => {
      const row = document.createElement('div');
      row.className = 'msg-row';
      const meta = document.createElement('div');
      meta.className = 'msg-meta';
      const time = m.timestamp ? new Date(m.timestamp).toLocaleString() : '';
      meta.innerHTML = `<strong>${escapeHtml(m.username || 'unknown')}</strong> <span class="time">${time}</span>`;
      const body = document.createElement('div');
      body.className = 'msg-body';
      body.textContent = m.message || '';
      row.appendChild(meta);
      row.appendChild(body);
      container.appendChild(row);
    });
    messagesList.innerHTML = '';
    messagesList.appendChild(container);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>\"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  }

  loadBtn.addEventListener('click', fetchRooms);

  // allow pressing enter in token field to load
  tokenInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') fetchRooms(); });

})();

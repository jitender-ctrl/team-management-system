import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Smile, Pin, Paperclip, Users, Search, X } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { fileUrl, formatBytes } from "../utils/files";

const QUICK_EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function isImage(fileType) {
  return fileType?.startsWith("image/");
}

function MessageBubble({ m, isMine, isSeen, onPin, onReact, onJumpTo, highlighted }) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  return (
    <div
      id={`msg-${m.id}`}
      className={`group flex ${isMine ? "justify-end" : "justify-start"} ${highlighted ? "bg-yellow-100 dark:bg-yellow-900/30 rounded-lg" : ""}`}
    >
      <div className="relative max-w-xs">
        {/* Hover toolbar: react + pin */}
        <div
          className={`absolute -top-3 ${isMine ? "left-0 -translate-x-full pr-1" : "right-0 translate-x-full pl-1"} hidden group-hover:flex items-center gap-1 bg-white border rounded-full shadow px-1 py-0.5 z-10`}
        >
          <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="px-1 text-slate-500" title="React">
            <Smile size={14} />
          </button>
          <button onClick={() => onPin(m)} className="px-1 text-slate-500" title={m.pinned ? "Unpin" : "Pin"}>
            <Pin size={14} />
          </button>
        </div>

        {showEmojiPicker && (
          <div className={`absolute -top-10 ${isMine ? "right-0" : "left-0"} bg-white border rounded-full shadow px-2 py-1 flex gap-1 z-20`}>
            {QUICK_EMOJI.map((e) => (
              <button
                key={e}
                onClick={() => {
                  onReact(m, e);
                  setShowEmojiPicker(false);
                }}
                className="text-sm hover:scale-125 transition-transform"
              >
                {e}
              </button>
            ))}
          </div>
        )}

        <div className={`px-3 py-2 rounded-lg text-sm ${isMine ? "bg-brand-600 text-white" : "bg-slate-100"}`}>
          {!isMine && <p className="text-xs font-semibold mb-0.5">{m.sender?.name}</p>}
          {m.pinned && <p className="text-[10px] mb-1 opacity-80 flex items-center gap-1"><Pin size={9} /> Pinned</p>}
          {m.fileUrl && isImage(m.fileType) && (
            <a href={fileUrl(m.fileUrl)} target="_blank" rel="noreferrer">
              <img src={fileUrl(m.fileUrl)} alt={m.fileName} className="rounded-md mb-1 max-h-48 object-cover" />
            </a>
          )}
          {m.fileUrl && !isImage(m.fileType) && (
            <a
              href={fileUrl(m.fileUrl)}
              target="_blank"
              rel="noreferrer"
              className={`flex items-center gap-2 mb-1 px-2 py-1.5 rounded-md text-xs ${isMine ? "bg-brand-700" : "bg-white border"}`}
            >
              <span><Paperclip size={12} /></span>
              <span className="truncate">{m.fileName}</span>
              <span className={isMine ? "text-brand-100" : "text-slate-400"}>{formatBytes(m.fileSize)}</span>
            </a>
          )}
          {m.body && <p>{m.body}</p>}
          <p className={`text-[10px] mt-1 ${isMine ? "text-brand-100" : "text-slate-400"}`}>
            {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            {isMine && isSeen && " · Seen"}
          </p>
        </div>

        {m.reactions?.length > 0 && (
          <div className={`flex gap-1 mt-1 flex-wrap ${isMine ? "justify-end" : "justify-start"}`}>
            {m.reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onReact(m, r.emoji)}
                className={`text-xs px-1.5 py-0.5 rounded-full border ${r.reactedByMe ? "bg-brand-50 border-brand-300" : "bg-white border-slate-200"}`}
              >
                {r.emoji} {r.count}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NewGroupPanel({ users, currentUserId, onCreated, onCancel }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim() || selected.length === 0) return;
    const { data } = await api.post("/chat/conversations/group", { name, memberIds: selected });
    onCreated(data.data);
  }

  return (
    <form onSubmit={handleCreate} className="p-3 border-b space-y-2">
      <input
        required
        placeholder="Group name"
        className="w-full border rounded-md p-2 text-sm"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <p className="text-xs text-slate-400">Add members</p>
      <div className="max-h-32 overflow-y-auto space-y-1">
        {users
          .filter((u) => u.id !== currentUserId)
          .map((u) => (
            <label key={u.id} className="flex items-center gap-2 text-sm px-1">
              <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} />
              {u.name}
            </label>
          ))}
      </div>
      <div className="flex gap-2">
        <button className="bg-brand-600 text-white text-xs px-3 py-1.5 rounded-md">Create Group</button>
        <button type="button" onClick={onCancel} className="text-xs px-3 py-1.5">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function Chat() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState({ direct: [], projects: [], groups: [] });
  const [users, setUsers] = useState([]);
  const [active, setActive] = useState(null); // { id, label, type, group? }
  const [messages, setMessages] = useState([]);
  const [readReceipts, setReadReceipts] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [showPinned, setShowPinned] = useState(false);
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [highlightedId, setHighlightedId] = useState(null);
  const pollRef = useRef(null);
  const typingPollRef = useRef(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingThrottleRef = useRef(0);

  function loadConversations() {
    api.get("/chat/conversations").then(({ data }) => {
      setConversations(data.data);
      const wantedProjectId = searchParams.get("project");
      const wantedGroupId = searchParams.get("group");
      if (wantedProjectId && !active) {
        const match = data.data.projects.find((c) => String(c.project.id) === wantedProjectId);
        if (match) setActive({ id: match.id, label: `# ${match.project.name}`, type: "PROJECT" });
      }
      if (wantedGroupId && !active) {
        const match = data.data.groups.find((c) => String(c.id) === wantedGroupId);
        if (match) setActive({ id: match.id, label: match.name, type: "GROUP", group: match });
      }
    });
  }

  useEffect(() => {
    loadConversations();
    api.get("/users").then(({ data }) => setUsers(data.data)).catch(() => {});
  }, []);

  // Poll the open conversation for new messages every 4s, mark it read, and
  // poll typing presence every 2s — all "live-ish" without a websocket server.
  useEffect(() => {
    if (!active) return;
    setShowSearch(false);
    setSearchResults([]);
    setHighlightedId(null);
    loadMessages(active.id, true);
    api.post(`/chat/conversations/${active.id}/read`).catch(() => {});
    api.get(`/chat/conversations/${active.id}/pinned`).then(({ data }) => setPinnedMessages(data.data)).catch(() => {});

    pollRef.current = setInterval(() => {
      loadMessages(active.id, false);
      api.post(`/chat/conversations/${active.id}/read`).catch(() => {});
    }, 4000);

    typingPollRef.current = setInterval(() => {
      api.get(`/chat/conversations/${active.id}/typing`).then(({ data }) => setTypingUsers(data.data)).catch(() => {});
    }, 2000);

    return () => {
      clearInterval(pollRef.current);
      clearInterval(typingPollRef.current);
      setTypingUsers([]);
    };
  }, [active?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function loadMessages(conversationId, replace) {
    api.get(`/chat/conversations/${conversationId}/messages`).then(({ data }) => {
      const { messages: incoming, readReceipts: receipts } = data.data;
      setReadReceipts(receipts);
      if (replace) setMessages(incoming);
      else if (incoming.length) setMessages((prev) => [...prev, ...dedupe(prev, incoming)]);
    });
  }

  function dedupe(prev, incoming) {
    const existingIds = new Set(prev.map((m) => m.id));
    return incoming.filter((m) => !existingIds.has(m.id));
  }

  async function openDirect(otherUser) {
    const { data } = await api.post(`/chat/conversations/direct/${otherUser.id}`);
    setActive({ id: data.data.id, label: otherUser.name, type: "DIRECT" });
    setShowNewChat(false);
    loadConversations();
  }

  function openProjectChat(conv) {
    setActive({ id: conv.id, label: `# ${conv.project.name}`, type: "PROJECT" });
  }

  function openGroupChat(conv) {
    setActive({ id: conv.id, label: conv.name, type: "GROUP", group: conv });
    setShowGroupInfo(false);
  }

  function handleGroupCreated(group) {
    setShowNewGroup(false);
    setActive({ id: group.id, label: group.name, type: "GROUP", group });
    loadConversations();
  }

  function handleFilePick(e) {
    const file = e.target.files?.[0];
    if (file) setPendingFile(file);
  }

  function handleDraftChange(e) {
    setDraft(e.target.value);
    // Throttle typing signals to at most once every 2s to avoid hammering the API.
    const now = Date.now();
    if (active && now - typingThrottleRef.current > 2000) {
      typingThrottleRef.current = now;
      api.post(`/chat/conversations/${active.id}/typing`).catch(() => {});
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if ((!draft.trim() && !pendingFile) || !active) return;

    if (pendingFile) {
      const form = new FormData();
      if (draft.trim()) form.append("body", draft.trim());
      form.append("file", pendingFile);
      await api.post(`/chat/conversations/${active.id}/messages`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    } else {
      await api.post(`/chat/conversations/${active.id}/messages`, { body: draft });
    }

    setDraft("");
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    loadMessages(active.id, true);
    loadConversations();
  }

  async function handleLeaveGroup() {
    if (!confirm(`Leave "${active.label}"?`)) return;
    await api.post(`/chat/conversations/${active.id}/leave`);
    setActive(null);
    setShowGroupInfo(false);
    loadConversations();
  }

  async function handleRemoveMember(memberId) {
    await api.delete(`/chat/conversations/${active.id}/members/${memberId}`);
    loadConversations();
    setActive((prev) => ({
      ...prev,
      group: { ...prev.group, members: prev.group.members.filter((m) => m.id !== memberId) },
    }));
  }

  async function handlePin(m) {
    await api.put(`/chat/messages/${m.id}/pin`);
    loadMessages(active.id, true);
    api.get(`/chat/conversations/${active.id}/pinned`).then(({ data }) => setPinnedMessages(data.data));
  }

  async function handleReact(m, emoji) {
    await api.post(`/chat/messages/${m.id}/reactions`, { emoji });
    loadMessages(active.id, true);
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim() || !active) return;
    const { data } = await api.get(`/chat/conversations/${active.id}/messages/search?q=${encodeURIComponent(searchQuery)}`);
    setSearchResults(data.data);
  }

  function jumpToMessage(messageId) {
    setShowSearch(false);
    setShowPinned(false);
    setHighlightedId(messageId);
    setTimeout(() => {
      document.getElementById(`msg-${messageId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    setTimeout(() => setHighlightedId(null), 2000);
  }

  const isGroupAdmin = active?.type === "GROUP" && active.group?.createdById === user?.id;

  // "Seen" = the last message I sent has been read (lastReadAt >= its
  // createdAt) by at least one other participant.
  const lastMineId = [...messages].reverse().find((m) => m.senderId === user?.id)?.id;
  const lastMine = messages.find((m) => m.id === lastMineId);
  const seenByOthers =
    lastMine && readReceipts.some((r) => r.userId !== user?.id && r.lastReadAt && new Date(r.lastReadAt) >= new Date(lastMine.createdAt));

  return (
    <div className="flex h-[calc(100vh-3rem)] -m-6 bg-white rounded-none">
      <div className="w-72 border-r flex flex-col">
        <div className="p-3 border-b flex justify-between items-center">
          <h2 className="font-semibold">Chat</h2>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowNewGroup(!showNewGroup);
                setShowNewChat(false);
              }}
              className="text-xs text-brand-600"
            >
              {showNewGroup ? "Cancel" : "+ Group"}
            </button>
            <button
              onClick={() => {
                setShowNewChat(!showNewChat);
                setShowNewGroup(false);
              }}
              className="text-xs text-brand-600"
            >
              {showNewChat ? "Cancel" : "+ New"}
            </button>
          </div>
        </div>

        {showNewGroup && (
          <NewGroupPanel
            users={users}
            currentUserId={user?.id}
            onCreated={handleGroupCreated}
            onCancel={() => setShowNewGroup(false)}
          />
        )}

        {showNewChat && (
          <div className="p-2 border-b max-h-48 overflow-y-auto">
            <p className="text-xs text-slate-400 px-1 mb-1">Message someone</p>
            {users.filter((u) => u.id !== user?.id).map((u) => (
              <button key={u.id} onClick={() => openDirect(u)} className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-slate-100">
                {u.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {conversations.groups.length > 0 && (
            <div className="px-3 pt-3 pb-1 text-xs font-semibold text-slate-400">GROUPS</div>
          )}
          {conversations.groups.map((c) => (
            <button
              key={c.id}
              onClick={() => openGroupChat(c)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${active?.id === c.id && active.type === "GROUP" ? "bg-slate-100" : ""}`}
            >
              <p className="font-medium flex items-center gap-1.5"><Users size={13} /> {c.name}</p>
              {c.lastMessage && <p className="text-xs text-slate-400 truncate">{c.lastMessage.fileUrl ? "Attachment" : c.lastMessage.body}</p>}
            </button>
          ))}

          {conversations.projects.length > 0 && (
            <div className="px-3 pt-3 pb-1 text-xs font-semibold text-slate-400">PROJECT GROUPS</div>
          )}
          {conversations.projects.map((c) => (
            <button
              key={c.id}
              onClick={() => openProjectChat(c)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${active?.id === c.id && active.type === "PROJECT" ? "bg-slate-100" : ""}`}
            >
              <p className="font-medium"># {c.project.name}</p>
              {c.lastMessage && <p className="text-xs text-slate-400 truncate">{c.lastMessage.fileUrl ? "Attachment" : c.lastMessage.body}</p>}
            </button>
          ))}

          {conversations.direct.length > 0 && (
            <div className="px-3 pt-3 pb-1 text-xs font-semibold text-slate-400">DIRECT MESSAGES</div>
          )}
          {conversations.direct.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive({ id: c.id, label: c.with?.name, type: "DIRECT" })}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${active?.id === c.id && active.type === "DIRECT" ? "bg-slate-100" : ""}`}
            >
              <p className="font-medium">{c.with?.name}</p>
              {c.lastMessage && <p className="text-xs text-slate-400 truncate">{c.lastMessage.fileUrl ? "Attachment" : c.lastMessage.body}</p>}
            </button>
          ))}

          {conversations.projects.length === 0 && conversations.direct.length === 0 && conversations.groups.length === 0 && (
            <p className="p-4 text-sm text-slate-400">No conversations yet. Join a project, start a group, or message someone directly.</p>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {active ? (
          <>
            <div className="p-3 border-b font-semibold flex justify-between items-center gap-2">
              <span className="truncate">{active.label}</span>
              <div className="flex gap-3 text-xs font-normal shrink-0">
                {pinnedMessages.length > 0 && (
                  <button onClick={() => { setShowPinned(!showPinned); setShowSearch(false); }} className="text-brand-600 flex items-center gap-1">
                    <Pin size={13} /> {pinnedMessages.length}
                  </button>
                )}
                <button onClick={() => { setShowSearch(!showSearch); setShowPinned(false); }} className="text-brand-600 flex items-center gap-1">
                  <Search size={13} /> Search
                </button>
                {active.type === "GROUP" && (
                  <button onClick={() => setShowGroupInfo(!showGroupInfo)} className="text-brand-600">
                    {showGroupInfo ? "Hide info" : "Group info"}
                  </button>
                )}
              </div>
            </div>

            {showSearch && (
              <div className="p-3 border-b bg-slate-50">
                <form onSubmit={handleSearch} className="flex gap-2 mb-2">
                  <input
                    autoFocus
                    className="flex-1 border rounded-md p-2 text-sm"
                    placeholder="Search this conversation…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button className="bg-brand-600 text-white px-3 py-2 rounded-md text-sm">Search</button>
                </form>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {searchResults.map((m) => (
                    <button key={m.id} onClick={() => jumpToMessage(m.id)} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-white border-b">
                      <span className="font-medium">{m.sender?.name}: </span>
                      {m.body}
                    </button>
                  ))}
                  {searchQuery && searchResults.length === 0 && <p className="text-xs text-slate-400">No matches.</p>}
                </div>
              </div>
            )}

            {showPinned && (
              <div className="p-3 border-b bg-slate-50 max-h-40 overflow-y-auto space-y-1">
                {pinnedMessages.map((m) => (
                  <button key={m.id} onClick={() => jumpToMessage(m.id)} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-white border-b">
                    <span className="font-medium">{m.sender?.name}: </span>
                    {m.body || (m.fileName ? `Attachment: ${m.fileName}` : "")}
                  </button>
                ))}
              </div>
            )}

            {active.type === "GROUP" && showGroupInfo && (
              <div className="p-3 border-b bg-slate-50 text-sm space-y-2">
                <p className="text-xs font-semibold text-slate-400">MEMBERS</p>
                {active.group?.members.map((m) => (
                  <div key={m.id} className="flex justify-between items-center">
                    <span>
                      {m.name} {m.id === active.group.createdById && <span className="text-xs text-slate-400">(admin)</span>}
                    </span>
                    {isGroupAdmin && m.id !== user?.id && (
                      <button onClick={() => handleRemoveMember(m.id)} className="text-xs text-red-600">
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={handleLeaveGroup} className="text-xs text-red-600 pt-2 border-t w-full text-left">
                  Leave group
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  m={m}
                  isMine={m.senderId === user?.id}
                  isSeen={m.id === lastMineId && seenByOthers}
                  onPin={handlePin}
                  onReact={handleReact}
                  highlighted={m.id === highlightedId}
                />
              ))}
              <div ref={bottomRef} />
            </div>

            {typingUsers.length > 0 && (
              <div className="px-4 pb-1 text-xs text-slate-400 italic">
                {typingUsers.map((t) => t.name).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing…
              </div>
            )}

            {pendingFile && (
              <div className="px-3 pt-2 flex items-center gap-2 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Paperclip size={12} /> {pendingFile.name}</span>
                <button type="button" onClick={() => { setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-red-600">
                  Remove
                </button>
              </div>
            )}

            <form onSubmit={handleSend} className="p-3 border-t flex gap-2 items-center">
              <input ref={fileInputRef} type="file" onChange={handleFilePick} className="hidden" id="chat-file-input" />
              <label htmlFor="chat-file-input" className="cursor-pointer px-1 text-slate-500" title="Attach a file">
                <Paperclip size={18} />
              </label>
              <input
                className="flex-1 border rounded-full px-4 py-2 text-sm"
                placeholder="Type a message..."
                value={draft}
                onChange={handleDraftChange}
              />
              <button className="bg-brand-600 text-white px-4 py-2 rounded-full text-sm">Send</button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            Select a conversation to start chatting
          </div>
        )}
      </div>
    </div>
  );
}

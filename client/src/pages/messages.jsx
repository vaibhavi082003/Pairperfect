import React, { useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { io } from "socket.io-client";

/* --- 🌸 Petals Data (Matrimony Royal Theme) --- */
const PETAL_COLORS = ["#ffb703", "#fb8500", "#ff7b54", "#ffd166", "#e63946"];
const PETALS = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 37 + 9) % 100,
  size: 9 + ((i * 5) % 11),
  dur: 11 + ((i * 7) % 9),
  delay: -((i * 3.1) % 16),
  color: PETAL_COLORS[i % PETAL_COLORS.length],
}));

/* --- 🏵️ Rotating Mandala Component --- */
function Mandala({ className }) {
  return (
    <svg className={className} viewBox="-200 -200 400 400" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="0.8">
        <circle r="196" />
        <circle r="186" strokeDasharray="3 6" />
        <circle r="118" />
        <circle r="68" />
        <circle r="28" />
        {Array.from({ length: 16 }).map((_, i) => (
          <g key={i} transform={`rotate(${i * 22.5})`}>
            <path d="M0 -120 C 26 -142 26 -168 0 -184 C -26 -168 -26 -142 0 -120Z" />
            <path d="M0 -70 C 12 -84 12 -102 0 -116 C -12 -102 -12 -84 0 -70Z" />
            <path d="M0 -30 L 8 -48 L 0 -66 L -8 -48 Z" />
          </g>
        ))}
      </g>
    </svg>
  );
}

export default function Messages() {
  const { user } = useAuth();
  const currentUserId = user?.id || user?._id;
  const [searchParams, setSearchParams] = useSearchParams();
  const targetUserId = searchParams.get("userId");

  const [connectedUsers, setConnectedUsers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [notification, setNotification] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // WhatsApp Features State
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [activeMenuMsgId, setActiveMenuMsgId] = useState(null);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [msgToForward, setMsgToForward] = useState(null);

  // 📎 Working Media Upload & Attachment Menu State
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const socketRef = useRef(null);
  const chatBottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);

  // Hidden File Inputs
  const docInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // SAFE HELPERS
  const getUserName = (u) => u?.fullName || u?.name || "Member";
  const getUserInitial = (u) => {
    const name =
      typeof u?.fullName === "string" && u.fullName.trim()
        ? u.fullName.trim()
        : typeof u?.name === "string" && u.name.trim()
        ? u.name.trim()
        : "";
    return name.charAt(0).toUpperCase() || "?";
  };
  const getId = (value) => {
    const id = value?._id || value?.id || value;
    return id == null ? "" : String(id);
  };
  const getUserPhoto = (u) => u?.photos?.[0] || u?.photo || u?.avatar || null;

  // 1. Socket Setup & Listeners
  useEffect(() => {
    if (!currentUserId) return undefined;

    const socket = io("http://localhost:5000", { withCredentials: true });
    socketRef.current = socket;

    socket.emit("joinUser", currentUserId);

    socket.on("onlineUsersList", (list) => {
      setOnlineUserIds(Array.isArray(list) ? list.map((id) => id.toString()) : []);
    });

    // 📩 Receive Message
    socket.on("receiveMessage", (msg) => {
      if (!msg || typeof msg !== "object") return;
      const isActiveConversation = activeChat && getId(activeChat) === getId(msg.sender);
      if (isActiveConversation) {
        setMessages((prev) => [...prev, msg]);
      }

      if (
        isActiveConversation &&
        typeof document !== "undefined" &&
        document.hasFocus()
      ) {
        socket.emit("markAsSeen", {
          senderId: getId(msg.sender),
          receiverId: currentUserId,
        });
      }
    });

    socket.on("messageSentAck", ({ tempId, savedMessage } = {}) => {
      if (!savedMessage) return;
      setMessages((prev) => {
        const index = prev.findIndex((message) => getId(message) === getId(tempId));
        if (index < 0) {
          return getId(savedMessage.receiver) === getId(activeChat)
            ? [...prev, savedMessage]
            : prev;
        }
        return prev.map((message, itemIndex) => itemIndex === index ? savedMessage : message);
      });
    });

    socket.on("messageSendError", ({ tempId, message } = {}) => {
      if (tempId) {
        setMessages((prev) => prev.filter((item) => getId(item) !== getId(tempId)));
      }
      setNotification(message || "Message could not be sent");
      setTimeout(() => setNotification(""), 3000);
    });

    // ⚡ DELIVERED (Double Grey Tick ✓✓)
    socket.on("messagesDeliveredToUser", ({ byUserId, receiverId } = {}) => {
      const deliveredUserId = getId(byUserId || receiverId);
      if (!activeChat || deliveredUserId !== getId(activeChat)) return;
      setMessages((prev) =>
        prev.map((m) =>
          getId(m.sender) === getId(currentUserId) &&
          getId(m.receiver) === deliveredUserId && m.status === "sent"
            ? { ...m, status: "delivered" }
            : m
        )
      );
    });

    // ⚡ SEEN (Double Blue Tick ✓✓)
    socket.on("messagesMarkedSeen", ({ seenBy, senderId } = {}) => {
      if (
        !activeChat ||
        getId(activeChat) !== getId(seenBy) ||
        (senderId && getId(senderId) !== getId(currentUserId))
      ) return;
      setMessages((prev) =>
        prev.map((m) =>
          getId(m.sender) === getId(currentUserId) && getId(m.receiver) === getId(seenBy)
            ? { ...m, status: "seen" }
            : m
        )
      );
    });

    socket.on("userTyping", ({ senderId }) => {
      if (activeChat && getId(activeChat) === getId(senderId)) {
        setIsTyping(true);
      }
    });

    socket.on("userStopTyping", ({ senderId }) => {
      if (activeChat && getId(activeChat) === getId(senderId)) {
        setIsTyping(false);
      }
    });

    socket.on("messageEdited", (updatedMsg) => {
      setMessages((prev) =>
        prev.map((m) =>
          getId(m) === getId(updatedMsg._id)
            ? { ...m, text: updatedMsg.text, isEdited: true }
            : m
        )
      );
    });

    socket.on("messageDeleted", ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => getId(m) !== getId(messageId)));
    });

    socket.on("messageReacted", (updatedMsg) => {
      setMessages((prev) =>
        prev.map((m) =>
          getId(m) === getId(updatedMsg._id)
            ? { ...m, reactions: updatedMsg.reactions }
            : m
        )
      );
    });

    socket.on("newConnectionReceived", (data) => {
      setNotification(data?.message || "Nayi request aayi hai!");
      fetchPendingRequests();
    });

    return () => {
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [currentUserId, activeChat]);

  // 2. Fetch Connections (✅ AUTO-SELECT REMOVED - Kisi ka chat bina click kare nahi khulega!)
  const fetchConnections = async () => {
    try {
      const res = await api.get("/connections/accepted");
      const list = Array.isArray(res.data) ? res.data : [];
      setConnectedUsers(list);

      // Agar URL me explicitly userId di ho tabhi khulega, varna koi chat auto nahi khulegi!
      if (targetUserId) {
        const found = list.find((c) => getId(c) === targetUserId);
        if (found) {
          setActiveChat(found);
        } else {
          setActiveChat({ _id: targetUserId, name: "Partner" });
        }
      }
    } catch (e) {
      console.warn("Connections fetch error:", e.message);
      setConnectedUsers([]);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const res = await api.get("/connections/pending");
      setPendingRequests(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setPendingRequests([]);
    }
  };

  useEffect(() => {
    fetchConnections();
    fetchPendingRequests();
  }, [targetUserId]);

  // 3. Load Active Chat History & Mark Seen Only When Opened
  useEffect(() => {
    const activeChatId = getId(activeChat);
    if (!activeChatId || !currentUserId) return;

    setLoadingHistory(true);
    setReplyingTo(null);
    setEditingMessage(null);
    setActiveMenuMsgId(null);
    setShowContactInfo(false);
    setShowAttachMenu(false);
    setIsTyping(false);

    api
      .get(`/messages/${activeChatId}`)
      .then((res) => {
        setMessages(Array.isArray(res.data) ? res.data : []);

        // ✅ User ne chat pe click karke khola hai, ab sender ko Blue Tick bhejo
        socketRef.current?.emit("markAsSeen", {
          senderId: activeChatId,
          receiverId: currentUserId,
        });
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingHistory(false));
  }, [activeChat, currentUserId]);

  // Tab switch par seen trigger karna (agar user ne tab badla aur wapas chat par aaya)
  useEffect(() => {
    const handleFocus = () => {
      const activeChatId = getId(activeChat);
      if (activeChatId && currentUserId) {
        socketRef.current?.emit("markAsSeen", {
          senderId: activeChatId,
          receiverId: currentUserId,
        });
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [activeChat, currentUserId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, uploading]);

  // 4. Send Message (Accurate Offline/Online Status Setup)
  const handleSendMessage = async (e, mediaData = null) => {
    if (e) e.preventDefault();
    const activeChatId = getId(activeChat);
    if ((!newMessage.trim() && !mediaData) || !activeChatId || !currentUserId) return;

    if (editingMessage) {
      try {
        await api.put(`/messages/${editingMessage._id}/edit`, { text: newMessage });
        setMessages((prev) =>
          prev.map((m) =>
            getId(m) === getId(editingMessage._id)
              ? { ...m, text: newMessage, isEdited: true }
              : m
          )
        );
        socketRef.current?.emit("editMessage", {
          _id: editingMessage._id,
          text: newMessage,
          receiverId: activeChatId,
        });
        setEditingMessage(null);
        setNewMessage("");
      } catch (err) {
        console.error("Edit message error", err);
      }
      return;
    }

    const tempId = Date.now().toString();

    // ⚡ REAL STATUS: Agar receiver online hai to 'delivered' (Double Grey), offline hai to 'sent' (Single Grey)
    // Yeh KABHI BHI initial stage me 'seen' nahi ho sakta!
    const isTargetOnline = onlineUserIds.includes(activeChatId.toString());
    const initialStatus = isTargetOnline ? "delivered" : "sent";

    const messagePayload = {
      _id: tempId,
      sender: currentUserId,
      receiver: activeChatId,
      text: newMessage.trim(),
      mediaUrl: mediaData?.url || null,
      mediaType: mediaData?.mediaType || null,
      fileName: mediaData?.fileName || null,
      fileSize: mediaData?.fileSize || null,
      replyTo: replyingTo
        ? {
            _id: replyingTo._id,
            text: replyingTo.text,
            sender: replyingTo.sender,
            mediaType: replyingTo.mediaType,
            fileName: replyingTo.fileName,
          }
        : null,
      status: initialStatus,
      reactions: [],
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, messagePayload]);

    const sendPayload = {
      senderId: currentUserId,
      receiverId: activeChatId,
      text: newMessage.trim(),
      mediaUrl: mediaData?.url || null,
      mediaType: mediaData?.mediaType || null,
      fileName: mediaData?.fileName || null,
      fileSize: mediaData?.fileSize || null,
      replyTo: replyingTo ? replyingTo._id : null,
      tempId,
    };

    // Socket.IO persists and broadcasts; use REST only when disconnected to
    // prevent duplicate database records.
    if (socketRef.current?.connected) {
      socketRef.current.emit("sendMessage", sendPayload);
    } else {
      try {
        const { data: savedMessage } = await api.post("/messages", {
          receiverId: activeChatId,
          text: newMessage.trim(),
          mediaUrl: mediaData?.url || null,
          mediaType: mediaData?.mediaType || null,
          fileName: mediaData?.fileName || null,
          fileSize: mediaData?.fileSize || null,
          replyTo: replyingTo ? replyingTo._id : null,
        });
        setMessages((prev) => prev.map((message) =>
          getId(message) === tempId ? savedMessage : message
        ));
      } catch (error) {
        setMessages((prev) => prev.filter((message) => getId(message) !== tempId));
        setNotification(error.response?.data?.message || "Message could not be sent");
        setTimeout(() => setNotification(""), 3000);
      }
    }

    socketRef.current?.emit("stopTyping", {
      senderId: currentUserId,
      receiverId: activeChatId,
    });

    setNewMessage("");
    setReplyingTo(null);
    setShowAttachMenu(false);
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    const activeChatId = getId(activeChat);
    if (!activeChatId || !currentUserId) return;

    socketRef.current?.emit("typing", {
      senderId: currentUserId,
      receiverId: activeChatId,
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit("stopTyping", {
        senderId: currentUserId,
        receiverId: activeChatId,
      });
    }, 1800);
  };

  // 5. 📁 File Upload Handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setShowAttachMenu(false);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await api.post("/messages/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      await handleSendMessage(null, res.data);
      setNotification(`Uploaded ${file.name}! ✓`);
      setTimeout(() => setNotification(""), 2000);
    } catch (err) {
      console.error("Upload failed:", err);
      setNotification("Upload failed. Ensure backend /upload route is active!");
      setTimeout(() => setNotification(""), 3000);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // 6. 🎙️ Voice Recording Engine
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, {
          type: "audio/webm",
        });

        setUploading(true);
        try {
          const formData = new FormData();
          formData.append("file", audioFile);
          const res = await api.post("/messages/upload", formData);
          await handleSendMessage(null, res.data);
        } catch (err) {
          console.error("Voice note upload failed:", err);
        } finally {
          setUploading(false);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert("Microphone permission required for voice notes!");
    }
  };

  const stopRecording = (cancel = false) => {
    if (mediaRecorderRef.current && isRecording) {
      if (cancel) {
        audioChunksRef.current = [];
        mediaRecorderRef.current.stop();
      } else {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current.stream?.getTracks().forEach((track) => track.stop());
    }
    clearInterval(recordTimerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
  };

  // 7. Delete Message
  const handleDeleteMessage = async (msgId, forEveryone = true) => {
    const activeChatId = getId(activeChat);
    setMessages((prev) => prev.filter((m) => getId(m) !== getId(msgId)));
    setActiveMenuMsgId(null);

    try {
      if (forEveryone) {
        await api.delete(`/messages/${msgId}`);
        socketRef.current?.emit("deleteMessage", {
          messageId: msgId,
          receiverId: activeChatId,
        });
        setNotification("Message deleted! 🗑️");
      }
      setTimeout(() => setNotification(""), 2000);
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // 8. React to Message
  const handleReact = async (msgId, emoji) => {
    try {
      const res = await api.post(`/messages/${msgId}/react`, { emoji });
      setMessages((prev) =>
        prev.map((m) =>
          getId(m) === getId(msgId) ? { ...m, reactions: res.data.reactions } : m
        )
      );
      socketRef.current?.emit("reactMessage", {
        _id: msgId,
        reactions: res.data.reactions,
        receiverId: getId(activeChat),
      });
      setActiveMenuMsgId(null);
    } catch (err) {
      console.error("React failed", err);
    }
  };

  // 9. Forward Message
  const handleForward = (targetUser) => {
    if (!msgToForward) return;
    const targetId = getId(targetUser);
    const tempId = Date.now().toString();

    socketRef.current?.emit("sendMessage", {
      senderId: currentUserId,
      receiverId: targetId,
      text: msgToForward.text,
      mediaUrl: msgToForward.mediaUrl,
      mediaType: msgToForward.mediaType,
      fileName: msgToForward.fileName,
      fileSize: msgToForward.fileSize,
      tempId,
    });

    setShowForwardModal(false);
    setMsgToForward(null);
    setNotification(`Forwarded to ${getUserName(targetUser)}! ➔`);
    setTimeout(() => setNotification(""), 2500);
  };

  const isUserOnline = (id) => id && onlineUserIds.includes(id.toString());
  
  const handleMobileBack = () => {
    setActiveChat(null);
    setShowContactInfo(false);
    setSearchParams({});
  };

  const filteredUsers = connectedUsers.filter((u) =>
    getUserName(u).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`wp-app ${activeChat ? "chat-open" : "sidebar-open"}`}>
      <style>{wpStyles}</style>

      {/* 🌸 BACKGROUND MANDALAS & PETALS */}
      <div className="wp-ambient-bg" aria-hidden="true">
        <div className="ambient-blob b1" />
        <div className="ambient-blob b2" />
        <div className="mandala-center-stage">
          <Mandala className="center-mandala m-outer" />
          <Mandala className="center-mandala m-inner" />
        </div>
        {PETALS.map((p, i) => (
          <i
            key={i}
            className="chat-petal"
            style={{
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: p.color,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
        <div className="chat-grain" />
      </div>

      {/* HIDDEN FILE INPUTS */}
      <input
        type="file"
        ref={docInputRef}
        style={{ display: "none" }}
        accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.zip"
        onChange={handleFileUpload}
      />
      <input
        type="file"
        ref={photoInputRef}
        style={{ display: "none" }}
        accept="image/*,video/*"
        onChange={handleFileUpload}
      />
      <input
        type="file"
        ref={audioInputRef}
        style={{ display: "none" }}
        accept="audio/*"
        onChange={handleFileUpload}
      />
      <input
        type="file"
        ref={cameraInputRef}
        style={{ display: "none" }}
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
      />

      {/* TOAST NOTIFICATION */}
      {notification && (
        <div className="wp-floating-toast">
          <span>{notification}</span>
          <button onClick={() => setNotification("")}>✕</button>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div className="wp-container">
        {/* ================= 1. SIDEBAR ================= */}
        <aside className="wp-sidebar">
          <div className="wp-sidebar-header">
            <Link to="/" className="wp-back-home">← PairPerfect</Link>
            <div className="wp-header-icons">
              <span title="Encrypted chats">🔒 Encrypted</span>
            </div>
          </div>

          {/* Pending Interests */}
          {pendingRequests.length > 0 && (
            <div className="wp-pending-box">
              <span>Pending Requests ({pendingRequests.length})</span>
              {pendingRequests.map((req) => (
                <div key={req._id} className="wp-pending-row">
                  <small>{getUserName(req.sender)}</small>
                  <div>
                    <button className="btn-p-acc" onClick={() => api.post("/connections/respond", { connectionId: req._id, status: "accepted" }).then(fetchConnections)}>✓</button>
                    <button className="btn-p-rej" onClick={() => api.post("/connections/respond", { connectionId: req._id, status: "rejected" }).then(fetchPendingRequests)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Search Box */}
          <div className="wp-search-bar">
            <div className="wp-search-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search or start a new chat"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Chat List */}
          <div className="wp-chat-list">
            {filteredUsers.length === 0 ? (
              <div className="wp-empty-list">
                <p>No active matches found.</p>
                <Link to="/" className="wp-find-link">Browse Matches ➔</Link>
              </div>
            ) : (
              filteredUsers.map((c) => {
                const online = isUserOnline(getId(c));
                const isSelected = getId(activeChat) === getId(c);
                const photo = getUserPhoto(c);

                return (
                  <div
                    key={c._id}
                    className={`wp-chat-item ${isSelected ? "active" : ""}`}
                    onClick={() => setActiveChat(c)}
                  >
                    <div className="wp-avatar-box">
                      {photo ? (
                        <img src={photo} alt="" className="wp-avatar-img" />
                      ) : (
                        <div className="wp-avatar-initial">{getUserInitial(c)}</div>
                      )}
                      {online && <span className="wp-online-badge" />}
                    </div>
                    <div className="wp-chat-info">
                      <div className="wp-info-top">
                        <h4>{getUserName(c)}</h4>
                        <span className="wp-time-small">{online ? <b className="online-green">Online</b> : "Offline"}</span>
                      </div>
                      <p className="wp-preview-txt">
                        {online ? "🟢 Active now on PairPerfect" : "Tap to open chat"}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ================= 2. CHAT WINDOW ================= */}
        <main className="wp-chat-window">
          {activeChat ? (
            <>
              {/* WhatsApp Header */}
              <div className="wp-header">
                <button type="button" className="wp-mobile-back" onClick={handleMobileBack}>❮</button>

                <div className="wp-header-user" onClick={() => setShowContactInfo(!showContactInfo)}>
                  <div className="wp-avatar-box mini">
                    {getUserPhoto(activeChat) ? (
                      <img src={getUserPhoto(activeChat)} alt="" className="wp-avatar-img mini" />
                    ) : (
                      <div className="wp-avatar-initial mini">{getUserInitial(activeChat)}</div>
                    )}
                    {isUserOnline(getId(activeChat)) && <span className="wp-online-badge mini" />}
                  </div>
                  <div className="wp-user-meta">
                    <h4>{getUserName(activeChat)}</h4>
                    <span className="wp-status-txt">
                      {isUserOnline(getId(activeChat)) ? "🟢 Online" : "tap here for contact info"}
                    </span>
                  </div>
                </div>

                <div className="wp-header-tools">
                  <button className="wp-tool-btn" onClick={() => setShowContactInfo(!showContactInfo)} title="Contact Info">
                    ℹ️
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="wp-messages-area" onClick={() => { setActiveMenuMsgId(null); setShowAttachMenu(false); }}>
                <div className="wp-encryption-badge">
                  🔒 Messages and calls are end-to-end encrypted. No one outside of this chat can read them.
                </div>

                {loadingHistory ? (
                  <div className="wp-loader">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="wp-no-msgs">
                    <span>💌</span>
                    <p>Start your alliance conversation with {getUserName(activeChat)}!</p>
                  </div>
                ) : (
                  messages.map((m, idx) => {
                    const isMine = getId(m.sender) === getId(currentUserId);
                    const msgId = getId(m);
                    const isMenuOpen = activeMenuMsgId === msgId;

                    return (
                      <div key={m._id || idx} className={`wp-bubble-row ${isMine ? "mine" : "theirs"}`}>
                        <div className="wp-bubble">
                          {/* Replied Snippet */}
                          {m.replyTo && (
                            <div className="wp-reply-quote">
                              <small>{getId(m.replyTo.sender) === getId(currentUserId) ? "You" : getUserName(activeChat)}</small>
                              <p>{m.replyTo.fileName ? `📁 ${m.replyTo.fileName}` : m.replyTo.text}</p>
                            </div>
                          )}

                          {/* 🖼️ MEDIA RENDERING: IMAGE / VIDEO / DOCUMENT / AUDIO */}
                          {m.mediaType === "image" && m.mediaUrl && (
                            <div className="wp-media-image-box">
                              <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer">
                                <img src={m.mediaUrl} alt="attachment" className="wp-bubble-img" />
                              </a>
                            </div>
                          )}

                          {m.mediaType === "video" && m.mediaUrl && (
                            <div className="wp-media-video-box">
                              <video src={m.mediaUrl} controls className="wp-bubble-video" />
                            </div>
                          )}

                          {m.mediaType === "document" && m.mediaUrl && (
                            <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer" download={m.fileName} className="wp-document-card">
                              <div className="wp-doc-icon">📄</div>
                              <div className="wp-doc-meta">
                                <span className="wp-doc-name">{m.fileName || "Document"}</span>
                                <span className="wp-doc-size">{m.fileSize || "File"} • Click to download</span>
                              </div>
                              <span className="wp-doc-download">⬇</span>
                            </a>
                          )}

                          {m.mediaType === "audio" && m.mediaUrl && (
                            <div className="wp-audio-box">
                              <audio src={m.mediaUrl} controls className="wp-bubble-audio" />
                            </div>
                          )}

                          {/* Text and Time Content */}
                          <div className="wp-bubble-content">
                            {m.text && <span className="wp-msg-text">{m.text}</span>}
                            <div className="wp-bubble-meta">
                              {m.isEdited && <span className="wp-edited">edited</span>}
                              <span className="wp-time">
                                {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                              </span>

                              {/* ⚡ STRICT WHATSAPP TICK LOGIC */}
                              {isMine && (
                                <span
                                  className={`wp-ticks ${
                                    m.status === "seen"
                                      ? "tick-seen"
                                      : m.status === "delivered"
                                      ? "tick-delivered"
                                      : "tick-sent"
                                  }`}
                                  title={
                                    m.status === "seen"
                                      ? "Read"
                                      : m.status === "delivered"
                                      ? "Delivered"
                                      : "Sent"
                                  }
                                >
                                  {m.status === "seen"
                                    ? "✓✓"
                                    : m.status === "delivered"
                                    ? "✓✓"
                                    : "✓"}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Reaction badge */}
                          {m.reactions && m.reactions.length > 0 && (
                            <div className="wp-reaction-badge">
                              {Array.from(new Set(m.reactions.map((r) => r.emoji))).join(" ")}
                              {m.reactions.length > 1 && <span className="r-n">{m.reactions.length}</span>}
                            </div>
                          )}

                          {/* Trigger Arrow for Actions */}
                          <button
                            type="button"
                            className="wp-bubble-arrow"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuMsgId(isMenuOpen ? null : msgId);
                            }}
                          >
                            ⌄
                          </button>

                          {/* Action Dropdown */}
                          {isMenuOpen && (
                            <div className="wp-action-dropdown" onClick={(e) => e.stopPropagation()}>
                              <div className="wp-dropdown-emojis">
                                {["❤️", "👍", "😂", "😮", "😢", "🙏"].map((em) => (
                                  <span key={em} onClick={() => handleReact(msgId, em)}>{em}</span>
                                ))}
                              </div>
                              <button onClick={() => { setReplyingTo(m); setActiveMenuMsgId(null); inputRef.current?.focus(); }}>↩ Reply</button>
                              {m.text && (
                                <button onClick={() => { navigator.clipboard.writeText(m.text); setNotification("Copied! 📋"); setActiveMenuMsgId(null); setTimeout(() => setNotification(""), 2000); }}>📋 Copy</button>
                              )}
                              <button onClick={() => { setMsgToForward(m); setShowForwardModal(true); setActiveMenuMsgId(null); }}>➔ Forward</button>
                              {isMine && (
                                <button className="wp-danger-action" onClick={() => handleDeleteMessage(msgId, true)}>🗑️ Delete for everyone</button>
                              )}
                              <button className="wp-danger-action" onClick={() => handleDeleteMessage(msgId, false)}>🗑️ Delete for me</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {uploading && (
                  <div className="wp-uploading-pill">
                    <span className="dot" /><span className="dot" /><span className="dot" />
                    <span>Uploading attachment securely...</span>
                  </div>
                )}

                {isTyping && (
                  <div className="wp-typing-pill">
                    <span className="dot" /><span className="dot" /><span className="dot" />
                    <i>{getUserName(activeChat)} is typing...</i>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Reply / Edit Modifier Bar */}
              {(replyingTo || editingMessage) && (
                <div className="wp-modifier-bar">
                  <div className="wp-modifier-info">
                    {replyingTo && <p><b>Replying to:</b> {replyingTo.fileName ? `📁 ${replyingTo.fileName}` : replyingTo.text}</p>}
                    {editingMessage && <p><b>Editing:</b> {editingMessage.text}</p>}
                  </div>
                  <button className="wp-modifier-cancel" onClick={() => { setReplyingTo(null); setEditingMessage(null); setNewMessage(""); }}>✕</button>
                </div>
              )}

              {/* ================= 🔥 HORIZONTAL BOTTOM BAR ================= */}
              <div className="wp-bottom-bar">
                {/* 📎 ATTACHMENT POPUP MENU */}
                {showAttachMenu && (
                  <div className="wp-attach-popup">
                    <div className="wp-attach-item" onClick={() => docInputRef.current?.click()}>
                      <span className="wp-attach-icon">📄</span>
                      <span className="wp-attach-text">Document</span>
                    </div>

                    <div className="wp-attach-item" onClick={() => photoInputRef.current?.click()}>
                      <span className="wp-attach-icon">🖼️</span>
                      <span className="wp-attach-text">Photos & videos</span>
                    </div>

                    <div className="wp-attach-item" onClick={() => cameraInputRef.current?.click()}>
                      <span className="wp-attach-icon">📷</span>
                      <span className="wp-attach-text">Camera</span>
                    </div>

                    <div className="wp-attach-item" onClick={() => audioInputRef.current?.click()}>
                      <span className="wp-attach-icon">🎧</span>
                      <span className="wp-attach-text">Audio</span>
                    </div>

                    <div className="wp-attach-item" onClick={() => { setShowContactInfo(true); setShowAttachMenu(false); }}>
                      <span className="wp-attach-icon">👤</span>
                      <span className="wp-attach-text">Contact info</span>
                    </div>

                    <div className="wp-attach-item" onClick={() => { alert("Creating quick alliance poll!"); setShowAttachMenu(false); }}>
                      <span className="wp-attach-icon">📊</span>
                      <span className="wp-attach-text">Poll</span>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="wp-input-form-row">
                  {/* Emoji Button */}
                  <button
                    type="button"
                    className="wp-icon-action-btn"
                    onClick={() => setNewMessage((prev) => prev + " 😊")}
                    title="Emoji"
                  >
                    <svg viewBox="0 0 24 24" height="24" width="24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
                    </svg>
                  </button>

                  {/* Attachment Paperclip Button */}
                  <button
                    type="button"
                    className={`wp-icon-action-btn ${showAttachMenu ? "active" : ""}`}
                    onClick={() => setShowAttachMenu(!showAttachMenu)}
                    title="Attach Media"
                  >
                    <svg viewBox="0 0 24 24" height="24" width="24" fill="currentColor">
                      <path d="M1.816 15.556v.002c0 1.502.584 2.912 1.646 3.972s2.472 1.647 3.974 1.647a5.58 5.58 0 0 0 3.972-1.645l9.547-9.548c.769-.768 1.147-1.767 1.058-2.817-.079-.968-.548-1.927-1.319-2.698-1.594-1.592-4.068-1.711-5.517-.262l-7.916 7.915c-.378.381-.608.868-.67 1.369-.069.541.085 1.077.447 1.442.364.364.901.517 1.444.448.502-.061.987-.292 1.366-.67l5.96-5.96a.91.91 0 0 1 1.285 0 .91.91 0 0 1 0 1.286l-5.96 5.962a3.784 3.784 0 0 1-2.651 1.063c-.454 0-.912-.08-1.349-.247-.437-.168-.838-.423-1.173-.758a3.79 3.79 0 0 1-1.004-2.523c.002-.998.393-1.938 1.101-2.646l7.916-7.916c2.193-2.193 5.972-2.009 8.086.105 1.052 1.053 1.674 2.378 1.748 3.729.074 1.353-.404 2.651-1.348 3.596l-9.548 9.548a7.393 7.393 0 0 1-5.26 2.18c-1.99 0-3.861-.776-5.266-2.181a7.42 7.42 0 0 1-2.18-5.267c0-1.99.776-3.861 2.181-5.266l9.548-9.548a.91.91 0 0 1 1.285 0 .91.91 0 0 1 0 1.286l-9.548 9.548a5.57 5.57 0 0 0-1.646 3.972z" />
                    </svg>
                  </button>

                  {/* Input or Voice Recording Indicator */}
                  {isRecording ? (
                    <div className="wp-recording-bar">
                      <span className="rec-dot" />
                      <span>Recording: {recordingTime}s</span>
                      <button type="button" className="btn-cancel-rec" onClick={() => stopRecording(true)}>Cancel ✕</button>
                    </div>
                  ) : (
                    <input
                      ref={inputRef}
                      type="text"
                      className="wp-message-input-field"
                      placeholder="Type a message"
                      value={newMessage}
                      onChange={handleInputChange}
                    />
                  )}

                  {/* Send or Mic Button */}
                  {newMessage.trim() ? (
                    <button type="submit" className="wp-send-action-btn" title="Send message">
                      ➤
                    </button>
                  ) : isRecording ? (
                    <button type="button" className="wp-send-action-btn record-active" onClick={() => stopRecording(false)} title="Send Voice">
                      ✓
                    </button>
                  ) : (
                    <button type="button" className="wp-icon-action-btn" onClick={startRecording} title="Voice note">
                      <svg viewBox="0 0 24 24" height="24" width="24" fill="currentColor">
                        <path d="M11.999 14.942c2.001 0 3.531-1.53 3.531-3.531V4.35c0-2.001-1.53-3.531-3.531-3.531S8.469 2.35 8.469 4.35v7.061c0 2.001 1.53 3.531 3.53 3.531zm-2.03-10.592c0-1.178.852-2.03 2.03-2.03s2.03.852 2.03 2.03v7.061c0 1.178-.852 2.03-2.03 2.03s-2.03-.852-2.03-2.03V4.35zm8.384 7.061c0 3.32-2.82 5.952-6.354 5.952s-6.354-2.632-6.354-5.952H4.144c0 3.99 3.12 7.242 7.054 7.742v2.798H8.399v1.5h7.2v-1.5h-2.8v-2.798c3.934-.5 7.054-3.752 7.054-7.742h-1.501z" />
                      </svg>
                    </button>
                  )}
                </form>
              </div>
            </>
          ) : (
            <div className="wp-no-chat-screen">
              <span className="wp-hero-icon">💍</span>
              <h2>PairPerfect Web</h2>
              <p>Select any contact to start your conversation.</p>
              <div className="wp-hero-pill">🔒 End-to-end encrypted</div>
            </div>
          )}
        </main>

        {/* ================= 3. CONTACT INFO DRAWER ================= */}
        {showContactInfo && activeChat && (
          <aside className="wp-contact-drawer">
            <div className="wp-drawer-header">
              <button className="wp-drawer-close" onClick={() => setShowContactInfo(false)}>✕</button>
              <h3>Contact info</h3>
              <Link to={`/?userId=${getId(activeChat)}`} className="wp-drawer-edit" title="Profile">✏️</Link>
            </div>

            <div className="wp-drawer-body">
              <div className="wp-drawer-avatar-wrap">
                {getUserPhoto(activeChat) ? (
                  <img src={getUserPhoto(activeChat)} alt="" className="wp-drawer-avatar" />
                ) : (
                  <div className="wp-drawer-initial">{getUserInitial(activeChat)}</div>
                )}
              </div>

              <div className="wp-drawer-names">
                <h2>{getUserName(activeChat)}</h2>
                <span className="wp-drawer-phone">{activeChat?.phone || "+91 •••• ••••"}</span>
                <span className="wp-drawer-online-status">{isUserOnline(getId(activeChat)) ? "🟢 Online" : "⚪ Offline"}</span>
              </div>

              <div className="wp-drawer-section">
                <h4>About & Alliance Details</h4>
                <p className="wp-drawer-about">{activeChat?.about || activeChat?.bio || "Looking for a well-cultured life partner."}</p>
                <div className="wp-drawer-badges">
                  {activeChat?.caste && <span className="wp-badge">Caste: {activeChat.caste}</span>}
                  {activeChat?.occupation && <span className="wp-badge">Work: {activeChat.occupation}</span>}
                  {activeChat?.city && <span className="wp-badge">City: {activeChat.city}</span>}
                </div>
              </div>

              <div className="wp-drawer-footer-btn">
                <Link to="/" className="btn-full-profile">View Full Matrimony Profile ➔</Link>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* FORWARD MODAL */}
      {showForwardModal && (
        <div className="wp-modal-overlay" onClick={() => setShowForwardModal(false)}>
          <div className="wp-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="wp-modal-head">
              <h4>Forward message to</h4>
              <button onClick={() => setShowForwardModal(false)}>✕</button>
            </div>
            <div className="wp-modal-list">
              {connectedUsers.map((u) => (
                <div key={u._id} className="wp-modal-user" onClick={() => handleForward(u)}>
                  <div className="wp-avatar-box mini"><div className="wp-avatar-initial mini">{getUserInitial(u)}</div></div>
                  <div className="wp-modal-info">
                    <h5>{getUserName(u)}</h5>
                    <small>{isUserOnline(getId(u)) ? "Online" : "Offline"}</small>
                  </div>
                  <span className="wp-forward-send">Send ➔</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const wpStyles = `
  /* ================= RESET ================= */
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }

  ::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
  * { scrollbar-width: none !important; -ms-overflow-style: none !important; }

  .wp-app {
    width: 100vw; height: 100dvh; display: flex; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #14010a; color: #fff7e6; overflow: hidden; position: fixed; top: 0; left: 0;
  }

  /* 🌸 BACKGROUND */
  .wp-ambient-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
  .ambient-blob { position: absolute; border-radius: 50%; filter: blur(100px); opacity: 0.3; animation: drift 15s ease-in-out infinite alternate; }
  .b1 { width: 450px; height: 450px; background: #ffb703; top: 15%; left: 50%; transform: translate(-50%, -50%); }
  .b2 { width: 400px; height: 400px; background: #a3122f; bottom: 10%; left: 40%; opacity: 0.25; animation-delay: -5s; }
  .mandala-center-stage { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(900px, 95vw); height: min(900px, 95vw); display: flex; align-items: center; justify-content: center; }
  .center-mandala { position: absolute; width: 100%; height: 100%; color: #d4a72c; }
  .m-outer { opacity: 0.22; animation: spinClockwise 85s linear infinite; }
  .m-inner { width: 72%; height: 72%; opacity: 0.16; color: #f2cf6b; animation: spinCounterClockwise 60s linear infinite; }
  .chat-petal { position: absolute; top: -5%; border-radius: 0 100% 0 100%; opacity: 0; animation: petalFall linear infinite; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.4)); }
  .chat-grain { position: absolute; inset: 0; opacity: 0.06; mix-blend-mode: overlay; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.6'/%3E%3C/svg%3E"); }

  @keyframes spinClockwise { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes spinCounterClockwise { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
  @keyframes drift { from { transform: translate(-50%, -50%) scale(1); } to { transform: translate(-45%, -46%) scale(1.2); } }
  @keyframes petalFall { 0% { transform: translate3d(0, -6vh, 0) rotate(0deg); opacity: 0; } 10% { opacity: 0.65; } 50% { transform: translate3d(36px, 48vh, 0) rotate(190deg); opacity: 0.55; } 100% { transform: translate3d(-24px, 106vh, 0) rotate(380deg); opacity: 0; } }

  .wp-container { position: relative; z-index: 1; display: flex; width: 100%; height: 100%; }

  .wp-floating-toast { position: fixed; top: 16px; right: 16px; background: #7c0a2b; border: 1.5px solid #f2cf6b; color: #fff; padding: 10px 16px; border-radius: 8px; z-index: 3000; box-shadow: 0 8px 24px rgba(0,0,0,0.6); display: flex; gap: 10px; align-items: center; font-size: 13.5px; }
  .wp-floating-toast button { background: none; border: none; color: #f2cf6b; cursor: pointer; font-size: 16px; }

  /* SIDEBAR */
  .wp-sidebar { width: 360px; background: rgba(26, 2, 14, 0.88); border-right: 1px solid rgba(212, 167, 44, 0.22); display: flex; flex-direction: column; flex-shrink: 0; backdrop-filter: blur(14px); }
  .wp-sidebar-header { height: 56px; padding: 0 16px; background: rgba(38, 3, 20, 0.95); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(212, 167, 44, 0.18); }
  .wp-back-home { color: #f2cf6b; text-decoration: none; font-weight: 700; font-size: 14px; }
  .wp-header-icons { font-size: 11.5px; color: #a7d65a; }

  .wp-pending-box { background: rgba(212, 167, 44, 0.12); padding: 8px 14px; border-bottom: 1px solid rgba(212, 167, 44, 0.2); }
  .wp-pending-box span { font-size: 12px; color: #f2cf6b; font-weight: 600; }
  .wp-pending-row { display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 4px; margin-top: 4px; font-size: 12px; }
  .btn-p-acc { background: #0f7a55; border: none; color: #fff; padding: 2px 6px; border-radius: 3px; font-size: 10px; cursor: pointer; margin-right: 4px; }
  .btn-p-rej { background: #c92a2a; border: none; color: #fff; padding: 2px 6px; border-radius: 3px; font-size: 10px; cursor: pointer; }

  .wp-search-bar { padding: 10px 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
  .wp-search-input-wrap { background: rgba(255, 247, 230, 0.08); border-radius: 8px; display: flex; align-items: center; padding: 6px 12px; gap: 8px; border: 1px solid rgba(212, 167, 44, 0.2); }
  .search-icon { font-size: 13px; opacity: 0.6; }
  .wp-search-input-wrap input { background: transparent; border: none; color: #fff; outline: none; width: 100%; font-size: 13.5px; }

  .wp-chat-list { flex: 1; overflow-y: scroll; }
  .wp-empty-list { text-align: center; padding: 40px 16px; color: rgba(255,247,230,0.6); font-size: 13.5px; }
  .wp-find-link { color: #f2cf6b; display: inline-block; margin-top: 8px; font-weight: 600; text-decoration: underline; }

  .wp-chat-item { display: flex; gap: 12px; padding: 12px 16px; border-bottom: 1px solid rgba(255, 247, 230, 0.05); cursor: pointer; transition: background 0.15s; align-items: center; }
  .wp-chat-item:hover, .wp-chat-item.active { background: rgba(212, 167, 44, 0.16); }

  .wp-avatar-box { position: relative; width: 48px; height: 48px; flex-shrink: 0; }
  .wp-avatar-box.mini { width: 40px; height: 40px; }
  .wp-avatar-img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 1.5px solid #d4a72c; }
  .wp-avatar-initial { width: 100%; height: 100%; border-radius: 50%; background: #7c0a2b; color: #f2cf6b; display: grid; place-items: center; font-weight: 700; font-size: 18px; border: 1.5px solid #d4a72c; }
  .wp-avatar-initial.mini { font-size: 15px; }
  .wp-online-badge { position: absolute; bottom: 1px; right: 1px; width: 11px; height: 11px; background: #2ecc71; border-radius: 50%; border: 2px solid #1a020e; }

  .wp-chat-info { flex: 1; min-width: 0; }
  .wp-info-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 3px; }
  .wp-info-top h4 { font-size: 15px; color: #fff; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .wp-time-small { font-size: 11px; color: rgba(255,247,230,0.6); }
  .online-green { color: #2ecc71 !important; }
  .wp-preview-txt { font-size: 12.5px; color: rgba(255,247,230,0.6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* CHAT WINDOW */
  .wp-chat-window { flex: 1; display: flex; flex-direction: column; background: rgba(18, 1, 10, 0.76); height: 100%; position: relative; backdrop-filter: blur(10px); }

  .wp-header { height: 56px; padding: 0 16px; background: rgba(38, 3, 20, 0.95); border-bottom: 1px solid rgba(212, 167, 44, 0.2); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; z-index: 20; }
  .wp-mobile-back { display: none; background: none; border: none; color: #f2cf6b; font-size: 22px; cursor: pointer; padding-right: 8px; }
  .wp-header-user { display: flex; align-items: center; gap: 12px; cursor: pointer; flex: 1; }
  .wp-user-meta h4 { font-size: 15.5px; color: #fff; font-weight: 600; }
  .wp-status-txt { font-size: 11.5px; color: rgba(255, 247, 230, 0.65); }
  .wp-tool-btn { background: none; border: none; font-size: 18px; cursor: pointer; color: #f2cf6b; padding: 6px; }

  .wp-messages-area { flex: 1; overflow-y: scroll; padding: 16px 24px; display: flex; flex-direction: column; gap: 8px; }
  .wp-encryption-badge { margin: 0 auto 12px; background: rgba(212, 167, 44, 0.1); border: 1px dashed rgba(212, 167, 44, 0.3); padding: 6px 14px; border-radius: 8px; font-size: 11.5px; color: #f2cf6b; text-align: center; max-width: 440px; }
  .wp-loader { text-align: center; padding: 20px; font-size: 13px; color: rgba(255,247,230,0.5); }
  .wp-no-msgs { text-align: center; margin: auto; color: rgba(255,247,230,0.6); }
  .wp-no-msgs span { font-size: 38px; display: block; margin-bottom: 8px; }

  /* BUBBLES */
  .wp-bubble-row { display: flex; width: 100%; position: relative; }
  .wp-bubble-row.mine { justify-content: flex-end; }
  .wp-bubble-row.theirs { justify-content: flex-start; }

  .wp-bubble {
    position: relative; max-width: 70%; padding: 6px 10px 6px 12px; border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.4); word-break: break-word;
  }
  .mine .wp-bubble { background: #6e0824; color: #fff; border-top-right-radius: 2px; }
  .theirs .wp-bubble { background: #2a0416; color: #fff; border-top-left-radius: 2px; }

  /* 🖼️ MEDIA CARDS IN CHAT */
  .wp-bubble-img { max-width: 280px; max-height: 280px; border-radius: 8px; margin-bottom: 4px; display: block; object-fit: cover; }
  .wp-bubble-video { max-width: 280px; border-radius: 8px; margin-bottom: 4px; }
  .wp-document-card { display: flex; align-items: center; gap: 10px; background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 8px; text-decoration: none; color: #fff; margin-bottom: 4px; border: 1px solid rgba(212, 167, 44, 0.2); }
  .wp-doc-icon { font-size: 26px; }
  .wp-doc-meta { flex: 1; min-width: 0; }
  .wp-doc-name { display: block; font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px; }
  .wp-doc-size { font-size: 11px; opacity: 0.7; }
  .wp-doc-download { font-size: 18px; color: #f2cf6b; }
  .wp-bubble-audio { max-width: 240px; height: 36px; margin-bottom: 4px; }

  /* BUBBLE CONTENT */
  .wp-bubble-content {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 8px;
    padding-right: 14px;
  }
  .wp-msg-text { font-size: 14.5px; line-height: 1.4; flex: 1 1 auto; }
  .wp-bubble-meta {
    display: inline-flex; align-items: center; gap: 3px; font-size: 10px; opacity: 0.7;
    white-space: nowrap; margin-left: auto; padding-top: 4px;
  }
  .wp-edited { font-style: italic; color: #f2cf6b; }

  /* ⚡ ACCURATE TICKS CSS */
  .wp-ticks {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: -1px;
    margin-left: 2px;
    display: inline-flex;
    align-items: center;
  }
  /* Single Grey Tick */
  .wp-ticks.tick-sent {
    color: rgba(255, 255, 255, 0.45) !important;
  }
  /* Double Grey Tick */
  .wp-ticks.tick-delivered {
    color: rgba(255, 255, 255, 0.7) !important;
  }
  /* Double Blue Tick */
  .wp-ticks.tick-seen {
    color: #53bdeb !important;
  }

  .wp-reply-quote { background: rgba(0, 0, 0, 0.35); border-left: 3px solid #f2cf6b; padding: 3px 8px; border-radius: 4px; margin-bottom: 4px; font-size: 11.5px; }
  .wp-reply-quote small { color: #f2cf6b; font-weight: bold; }
  .wp-reply-quote p { margin: 0; opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }

  .wp-reaction-badge { position: absolute; bottom: -8px; right: 10px; background: #200211; border: 1px solid #d4a72c; border-radius: 12px; padding: 1px 5px; font-size: 10px; display: flex; align-items: center; gap: 2px; }
  .r-n { color: #f2cf6b; font-weight: bold; }

  .wp-bubble-arrow { position: absolute; top: 4px; right: 4px; background: none; border: none; color: #f2cf6b; font-size: 14px; cursor: pointer; opacity: 0; transition: opacity 0.2s; }
  .wp-bubble:hover .wp-bubble-arrow { opacity: 1; }

  .wp-action-dropdown { position: absolute; top: 24px; right: 8px; background: #280316; border: 1px solid #d4a72c; border-radius: 8px; padding: 4px 0; z-index: 100; box-shadow: 0 8px 24px rgba(0,0,0,0.8); min-width: 160px; }
  .wp-dropdown-emojis { display: flex; justify-content: space-around; padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 18px; }
  .wp-dropdown-emojis span { cursor: pointer; transition: transform 0.15s; }
  .wp-dropdown-emojis span:hover { transform: scale(1.3); }
  .wp-action-dropdown button { width: 100%; text-align: left; background: none; border: none; color: #fff; padding: 8px 14px; font-size: 13px; cursor: pointer; display: block; }
  .wp-action-dropdown button:hover { background: rgba(212, 167, 44, 0.2); color: #f2cf6b; }
  .wp-danger-action { color: #ff6b6b !important; }

  .wp-uploading-pill, .wp-typing-pill { background: rgba(255,247,230,0.1); padding: 6px 12px; border-radius: 12px; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #f2cf6b; }
  .dot { width: 5px; height: 5px; background: #f2cf6b; border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both; }
  .dot:nth-child(1) { animation-delay: -0.32s; } .dot:nth-child(2) { animation-delay: -0.16s; }
  @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }

  .wp-modifier-bar { background: #2c0418; border-top: 1px solid rgba(212, 167, 44, 0.3); padding: 6px 16px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #f2cf6b; }
  .wp-modifier-cancel { background: none; border: none; color: #fff; font-size: 14px; cursor: pointer; }

  /* ================= 🔥 HORIZONTAL BOTTOM BAR ================= */
  .wp-bottom-bar {
    position: relative;
    height: 62px;
    padding: 0 16px;
    background: #18010c;
    border-top: 1px solid rgba(212, 167, 44, 0.25);
    display: flex !important;
    align-items: center !important;
    flex-shrink: 0;
    z-index: 100;
  }

  .wp-input-form-row {
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    width: 100% !important;
    gap: 8px !important;
    margin: 0 !important;
  }

  .wp-icon-action-btn {
    background: none !important;
    border: none !important;
    color: #f2cf6b !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 6px !important;
    border-radius: 50% !important;
    transition: background 0.15s !important;
    flex-shrink: 0 !important;
  }
  .wp-icon-action-btn:hover, .wp-icon-action-btn.active {
    background: rgba(212, 167, 44, 0.15) !important;
  }

  .wp-message-input-field {
    flex: 1 !important;
    height: 42px !important;
    background: rgba(255, 247, 230, 0.08) !important;
    border: 1px solid rgba(212, 167, 44, 0.35) !important;
    border-radius: 22px !important;
    padding: 0 16px !important;
    color: #fff !important;
    font-size: 15px !important;
    outline: none !important;
    min-width: 0 !important;
  }
  .wp-message-input-field::placeholder {
    color: rgba(255, 247, 230, 0.5) !important;
  }

  .wp-send-action-btn {
    width: 42px !important;
    height: 42px !important;
    border-radius: 50% !important;
    background: #d4a72c !important;
    color: #200210 !important;
    border: none !important;
    font-size: 18px !important;
    font-weight: bold !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex-shrink: 0 !important;
  }
  .wp-send-action-btn.record-active {
    background: #2ecc71 !important;
    color: #fff !important;
  }

  .wp-recording-bar {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    color: #ff6b6b;
    font-size: 14px;
    font-weight: 600;
  }
  .rec-dot { width: 10px; height: 10px; background: #ff4d4d; border-radius: 50%; animation: blink 1s infinite; }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
  .btn-cancel-rec { background: none; border: none; color: #fff; font-size: 12px; cursor: pointer; text-decoration: underline; }

  /* 📎 ATTACHMENT POPUP MENU */
  .wp-attach-popup {
    position: absolute;
    bottom: 68px;
    left: 45px;
    background: #250215;
    border: 1.5px solid #d4a72c;
    border-radius: 14px;
    padding: 8px 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.85);
    z-index: 500;
    min-width: 200px;
    animation: popUp 0.15s ease;
  }
  @keyframes popUp {
    from { opacity: 0; transform: translateY(8px) scale(0.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .wp-attach-item {
    display: flex; align-items: center; gap: 12px; padding: 9px 12px; border-radius: 8px; cursor: pointer; transition: background 0.15s;
  }
  .wp-attach-item:hover { background: rgba(212, 167, 44, 0.2); }
  .wp-attach-icon { font-size: 20px; display: flex; align-items: center; justify-content: center; width: 24px; }
  .wp-attach-text { font-size: 14px; font-weight: 500; color: #fff; }

  /* CONTACT DRAWER */
  .wp-contact-drawer { width: 360px; background: rgba(30, 3, 16, 0.95); border-left: 1px solid rgba(212, 167, 44, 0.25); display: flex; flex-direction: column; height: 100%; overflow-y: scroll; flex-shrink: 0; }
  .wp-drawer-header { height: 56px; padding: 0 16px; background: rgba(43, 4, 23, 0.98); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(212, 167, 44, 0.2); }
  .wp-drawer-close { background: none; border: none; color: #fff; font-size: 18px; cursor: pointer; }
  .wp-drawer-header h3 { font-size: 16px; color: #fff; }
  .wp-drawer-edit { color: #f2cf6b; font-size: 16px; text-decoration: none; }
  .wp-drawer-body { padding: 20px 16px; display: flex; flex-direction: column; gap: 16px; }
  .wp-drawer-avatar-wrap { width: 130px; height: 130px; margin: 0 auto; border-radius: 50%; overflow: hidden; border: 3px solid #d4a72c; }
  .wp-drawer-avatar { width: 100%; height: 100%; object-fit: cover; }
  .wp-drawer-initial { width: 100%; height: 100%; background: #7c0a2b; color: #f2cf6b; display: grid; place-items: center; font-size: 46px; font-weight: bold; }
  .wp-drawer-names { text-align: center; }
  .wp-drawer-names h2 { font-size: 20px; color: #fff; }
  .wp-drawer-phone { display: block; font-size: 13.5px; color: rgba(255, 247, 230, 0.65); }
  .wp-drawer-online-status { font-size: 12px; color: #2ecc71; font-weight: 600; }
  .wp-drawer-section { background: rgba(0,0,0,0.25); border-radius: 10px; padding: 12px 14px; border: 1px solid rgba(212, 167, 44, 0.15); }
  .wp-drawer-section h4 { font-size: 13.5px; color: #f2cf6b; margin-bottom: 6px; }
  .wp-drawer-about { font-size: 13px; color: rgba(255, 247, 230, 0.85); line-height: 1.45; }
  .wp-drawer-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .wp-badge { background: rgba(212, 167, 44, 0.15); font-size: 11px; padding: 3px 8px; border-radius: 4px; color: #f2cf6b; }
  .btn-full-profile { display: block; text-align: center; background: #d4a72c; color: #200210; text-decoration: none; font-weight: 700; padding: 12px; border-radius: 999px; font-size: 13.5px; }

  /* FORWARD MODAL */
  .wp-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.78); display: flex; align-items: center; justify-content: center; z-index: 4000; }
  .wp-modal-card { background: #250314; border: 1.5px solid #d4a72c; border-radius: 12px; width: 90%; max-width: 360px; max-height: 75vh; display: flex; flex-direction: column; overflow: hidden; }
  .wp-modal-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid rgba(212, 167, 44, 0.25); }
  .wp-modal-head h4 { font-size: 15px; color: #f2cf6b; }
  .wp-modal-head button { background: none; border: none; color: #fff; font-size: 16px; cursor: pointer; }
  .wp-modal-list { overflow-y: scroll; padding: 6px 0; }
  .wp-modal-user { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; }
  .wp-modal-info { flex: 1; }
  .wp-modal-info h5 { font-size: 14px; color: #fff; }
  .wp-modal-info small { color: rgba(255,255,255,0.6); font-size: 11px; }
  .wp-forward-send { color: #f2cf6b; font-size: 13px; font-weight: 600; }

  .wp-no-chat-screen { margin: auto; text-align: center; color: rgba(255, 247, 230, 0.6); max-width: 400px; padding: 20px; }
  .wp-hero-icon { font-size: 54px; display: block; margin-bottom: 12px; }
  .wp-hero-pill { display: inline-block; margin-top: 18px; font-size: 12px; background: rgba(212, 167, 44, 0.12); color: #f2cf6b; border: 1px solid rgba(212, 167, 44, 0.3); padding: 5px 12px; border-radius: 999px; }

  /* 📱 MOBILE RESPONSIVE */
  @media (max-width: 768px) {
    .wp-app.sidebar-open .wp-sidebar { width: 100vw; display: flex; }
    .wp-app.sidebar-open .wp-chat-window { display: none; }
    .wp-app.chat-open .wp-sidebar { display: none; }
    .wp-app.chat-open .wp-chat-window { width: 100vw; display: flex; }
    .wp-mobile-back { display: inline-block; }
    .wp-bubble { max-width: 82%; }
    .wp-messages-area { padding: 12px 10px; }
    .wp-bubble-arrow { opacity: 0.8; }
    .wp-contact-drawer { position: absolute; top: 0; right: 0; width: 100vw; height: 100%; z-index: 50; }
    .wp-attach-popup { left: 10px; }
  }
`;
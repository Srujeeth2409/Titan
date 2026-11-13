"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  apiGetMeeting,
  apiUpdateMeeting,
  apiConvertMeetingActions,
  apiSendMeetingSignal,
  apiPollMeetingSignals,
  MeetingItem,
} from "@/lib/api";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  ScreenShare,
  PhoneOff,
  Copy,
  Check,
  Users,
  MessageSquare,
  FileText,
  Plus,
  CheckSquare,
  Send,
  Loader2,
  Sparkles,
  Radio,
} from "lucide-react";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302", "stun:stun3.l.google.com:19302"] },
  ],
};

function RemoteVideoTile({
  peerId,
  name,
  stream,
}: {
  peerId: string;
  name: string;
  stream: MediaStream;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;

    const playVideo = () => {
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          // Autoplay policy fallback: click anywhere to unmute/start playback
          const onUserInteraction = () => {
            video.play().then(() => setIsPlaying(true)).catch(() => {});
            window.removeEventListener("click", onUserInteraction);
          };
          window.addEventListener("click", onUserInteraction);
        });
    };

    playVideo();

    const vTrack = stream.getVideoTracks()[0];
    if (vTrack) {
      vTrack.onunmute = () => {
        setIsPlaying(true);
        playVideo();
      };
    }
  }, [stream]);

  return (
    <div className="relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-lg min-h-[240px]">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      {!isPlaying && (
        <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center gap-3">
          <div className="w-16 h-16 rounded-full bg-emerald-600 flex items-center justify-center text-xl font-bold shadow-md text-white">
            {name.slice(0, 2).toUpperCase()}
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-white">{name}</p>
            <p className="text-xs text-slate-400">Connected Colleague</p>
          </div>
        </div>
      )}
      <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-lg text-xs font-medium text-white flex items-center gap-1.5 z-10">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>{name}</span>
      </div>
    </div>
  );
}

export default function MeetingRoomPage() {
  const params = useParams();
  const roomCode = params.room as string;
  const router = useRouter();
  const { user } = useAuth();

  const [meeting, setMeeting] = useState<MeetingItem | null>(null);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Tabs: notes, actions, chat
  const [activeTab, setActiveTab] = useState<"notes" | "actions" | "chat">("actions");
  const [notesText, setNotesText] = useState("");
  const [actionItems, setActionItems] = useState<Array<{ title: string; assignee_name?: string; priority?: string }>>([]);
  const [newActionTitle, setNewActionTitle] = useState("");
  const [newActionAssignee, setNewActionAssignee] = useState("");
  const [converting, setConverting] = useState(false);
  const [convertedNotice, setConvertedNotice] = useState<string | null>(null);

  // In-meeting chat
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; text: string; time: string }>>([
    { sender: "System", text: `Connected to secure room ${roomCode}`, time: "Just now" },
  ]);
  const [chatInput, setChatInput] = useState("");

  // Peer & Stream Management
  const myPeerId = useRef<string>(Math.random().toString(36).slice(2, 10));
  const myName = useRef<string>(
    user?.full_name || (user?.email ? user.email.split("@")[0].toUpperCase() : "User " + myPeerId.current.slice(0, 4))
  );
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const candidateQueue = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const [remotePeers, setRemotePeers] = useState<Map<string, { stream: MediaStream; name: string }>>(new Map());
  const supabaseChannelRef = useRef<any>(null);

  // Sync myName if user loads later
  useEffect(() => {
    if (user?.full_name) {
      myName.current = user.full_name;
    } else if (user?.email) {
      myName.current = user.email.split("@")[0].toUpperCase();
    }
  }, [user]);

  // Unified Signaling Sender (Supabase Realtime + Titan API Fallback)
  const sendSignal = useCallback(async (
    signalType: string,
    targetPeerId?: string | null,
    data?: any
  ) => {
    const payload = {
      peer_id: myPeerId.current,
      sender_name: myName.current,
      signal_type: signalType,
      target_peer_id: targetPeerId || null,
      data: data || {},
    };

    // 1. Send via active, subscribed Supabase channel
    if (supabaseChannelRef.current) {
      try {
        await supabaseChannelRef.current.send({
          type: "broadcast",
          event: "webrtc-signal",
          payload,
        });
      } catch (err) {
        console.warn("[Supabase Broadcast] error:", err);
      }
    }

    // 2. Also send via Titan Signaling API fallback
    try {
      await apiSendMeetingSignal(roomCode, payload);
    } catch {}
  }, [roomCode]);

  // Create or get RTCPeerConnection for a remote peer
  const getOrCreatePeerConnection = useCallback((peerId: string, peerName: string) => {
    if (peerConnections.current.has(peerId)) {
      return peerConnections.current.get(peerId)!;
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnections.current.set(peerId, pc);

    // Add local tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, localStreamRef.current!);
        } catch {}
      });
    }

    // Listen for remote tracks
    pc.ontrack = (event) => {
      let stream = (event.streams && event.streams[0]) || null;
      if (!stream) {
        stream = new MediaStream([event.track]);
      }
      setRemotePeers((prev) => {
        const next = new Map(prev);
        const existing = next.get(peerId);
        if (existing) {
          if (!existing.stream.getTracks().some((t) => t.id === event.track.id)) {
            existing.stream.addTrack(event.track);
          }
          next.set(peerId, { stream: existing.stream, name: peerName });
        } else {
          next.set(peerId, { stream, name: peerName });
        }
        return next;
      });
    };

    // Exchange ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal("candidate", peerId, event.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed" || pc.connectionState === "closed") {
        setRemotePeers((prev) => {
          const next = new Map(prev);
          next.delete(peerId);
          return next;
        });
        peerConnections.current.delete(peerId);
      }
    };

    return pc;
  }, [sendSignal]);

  // Handle incoming signaling messages
  const handleIncomingSignal = useCallback(async (signal: {
    peer_id: string;
    sender_name: string;
    signal_type: string;
    target_peer_id?: string | null;
    data: any;
  }) => {
    if (signal.peer_id === myPeerId.current) return;
    if (signal.target_peer_id && signal.target_peer_id !== myPeerId.current) return;

    const { peer_id, sender_name, signal_type, data } = signal;

    if (signal_type === "join") {
      // Deterministic Offerer to eliminate glare/collision:
      // The peer with the lexicographically smaller peer_id initiates the offer.
      // The other peer waits and answers.
      if (myPeerId.current < peer_id) {
        const pc = getOrCreatePeerConnection(peer_id, sender_name);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal("offer", peer_id, offer);
        } catch (err) {
          console.error("[WebRTC] createOffer error:", err);
        }
      }
    } else if (signal_type === "offer") {
      // Received offer from peer: set remote description, create and send answer
      const pc = getOrCreatePeerConnection(peer_id, sender_name);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data));

        // Flush any queued candidates
        const queued = candidateQueue.current.get(peer_id) || [];
        for (const cand of queued) {
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
        candidateQueue.current.delete(peer_id);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal("answer", peer_id, answer);
      } catch (err) {
        console.error("[WebRTC] setRemoteDescription/createAnswer error:", err);
      }
    } else if (signal_type === "answer") {
      // Received answer from peer
      const pc = peerConnections.current.get(peer_id);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data));

          // Flush any queued candidates
          const queued = candidateQueue.current.get(peer_id) || [];
          for (const cand of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          candidateQueue.current.delete(peer_id);
        } catch (err) {
          console.error("[WebRTC] setRemoteDescription(answer) error:", err);
        }
      }
    } else if (signal_type === "candidate") {
      // Received ICE candidate
      const pc = peerConnections.current.get(peer_id);
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data));
        } catch (err) {
          console.error("[WebRTC] addIceCandidate error:", err);
        }
      } else {
        const q = candidateQueue.current.get(peer_id) || [];
        q.push(data);
        candidateQueue.current.set(peer_id, q);
      }
    } else if (signal_type === "leave") {
      const pc = peerConnections.current.get(peer_id);
      if (pc) {
        pc.close();
        peerConnections.current.delete(peer_id);
      }
      setRemotePeers((prev) => {
        const next = new Map(prev);
        next.delete(peer_id);
        return next;
      });
    } else if (signal_type === "chat") {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: sender_name,
          text: data.text || "",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }, [getOrCreatePeerConnection, sendSignal]);

  // Main lifecycle: Setup media & Signaling
  useEffect(() => {
    let mounted = true;
    let pollInterval: NodeJS.Timeout | null = null;
    let lastPollTime = 0;

    async function init() {
      // 1. Load meeting record from DB
      try {
        const data = await apiGetMeeting(roomCode);
        if (mounted) {
          setMeeting(data);
          setNotesText(data.notes || "");
          setActionItems(data.action_items || [
            { title: "Review quarterly security benchmark report", assignee_name: "Engineering", priority: "high" },
            { title: "Update employee access policy for Finance documents", assignee_name: "HR Lead", priority: "medium" },
          ]);
        }
      } catch {}

      // 2. Initialize camera & microphone
      try {
        if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
          let stream: MediaStream | null = null;
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 1280 }, height: { ideal: 720 } },
              audio: true,
            });
          } catch {
            // Fallback: try audio only
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: true,
              });
              if (mounted) setIsVideoOn(false);
            } catch {
              console.warn("Camera/mic access unavailable");
            }
          }

          if (mounted && stream) {
            localStreamRef.current = stream;
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }
            // Add tracks to any existing peer connections
            peerConnections.current.forEach((pc) => {
              stream!.getTracks().forEach((track) => {
                try {
                  pc.addTrack(track, stream!);
                } catch {}
              });
            });
          }
        }
      } catch {
        if (mounted) setIsVideoOn(false);
      }

      // 3. Connect Supabase Realtime Channel if configured
      if (isSupabaseConfigured && supabase) {
        const channel = supabase.channel(`meeting_${roomCode}`, {
          config: { broadcast: { self: false } },
        });
        supabaseChannelRef.current = channel;

        channel
          .on("broadcast", { event: "webrtc-signal" }, ({ payload }) => {
            if (mounted && payload) {
              handleIncomingSignal(payload);
            }
          })
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              sendSignal("join");
            }
          });
      }

      // 4. Announce join via signal bus & poll for peers
      await sendSignal("join");

      // 5. Periodic announce every 3.5s until connected so new peers pair immediately
      const announceInterval = setInterval(() => {
        if (!mounted) return;
        if (peerConnections.current.size === 0) {
          sendSignal("join");
        }
      }, 3500);

      pollInterval = setInterval(async () => {
        if (!mounted) return;
        try {
          const res = await apiPollMeetingSignals(roomCode, myPeerId.current, lastPollTime);
          if (res?.timestamp) {
            lastPollTime = res.timestamp;
          }
          if (res?.signals && Array.isArray(res.signals)) {
            for (const s of res.signals) {
              await handleIncomingSignal(s);
            }
          }
        } catch {}
      }, 1000);
    }

    init();

    return () => {
      mounted = false;
      if (pollInterval) clearInterval(pollInterval);
      sendSignal("leave");

      // Clean up Supabase channel
      if (supabaseChannelRef.current && supabase) {
        try {
          supabase.removeChannel(supabaseChannelRef.current);
          supabaseChannelRef.current = null;
        } catch {}
      }

      // Close all peer connections
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();

      // Stop camera/mic tracks
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [roomCode, handleIncomingSignal, sendSignal]);

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
      }
    } else {
      setIsVideoOn(!isVideoOn);
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioOn(audioTrack.enabled);
      }
    } else {
      setIsAudioOn(!isAudioOn);
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Revert to camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: isAudioOn });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        // Replace video track in all active peer connections
        const newTrack = stream.getVideoTracks()[0];
        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
          if (sender && newTrack) sender.replaceTrack(newTrack);
        });
      } catch {}
      setIsScreenSharing(false);
    } else {
      try {
        if (navigator.mediaDevices?.getDisplayMedia) {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          localStreamRef.current = screenStream;
          if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
          setIsScreenSharing(true);

          const screenTrack = screenStream.getVideoTracks()[0];
          peerConnections.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
            if (sender && screenTrack) sender.replaceTrack(screenTrack);
          });

          screenTrack.onended = () => {
            setIsScreenSharing(false);
            toggleScreenShare();
          };
        }
      } catch {}
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const text = chatInput.trim();
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    setChatMessages((prev) => [...prev, { sender: "You", text, time: timeStr }]);
    sendSignal("chat", null, { text });
    setChatInput("");
  };

  const handleAddActionItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActionTitle.trim()) return;

    const updated = [
      ...actionItems,
      {
        title: newActionTitle.trim(),
        assignee_name: newActionAssignee.trim() || "Titan Staff",
        priority: "medium",
      },
    ];
    setActionItems(updated);
    setNewActionTitle("");
    setNewActionAssignee("");

    try {
      await apiUpdateMeeting(roomCode, { action_items: updated });
    } catch (err) {
      console.error(err);
    }
  };

  const handleConvertActionItems = async () => {
    if (actionItems.length === 0) return;
    setConverting(true);
    setConvertedNotice(null);
    try {
      const res = await apiConvertMeetingActions(roomCode, actionItems);
      setConvertedNotice(`Converted ${res.converted_count} action items to Titan Tasks!`);
    } catch {
      setConvertedNotice("Failed to convert action items to tasks.");
    } finally {
      setConverting(false);
    }
  };

  const totalParticipants = 1 + remotePeers.size;

  return (
    <div className="flex flex-col h-[calc(100vh-175px)] w-full bg-slate-950 text-white overflow-hidden rounded-2xl border border-slate-800 shadow-2xl">
      {/* Top Meeting Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>{meeting?.title || `Conference ${roomCode}`}</span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono">
                {roomCode}
              </span>
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Host: {meeting?.host_name || "Internal Workspace"}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>{totalParticipants} in room {isSupabaseConfigured ? "(Supabase Realtime)" : "(Titan WebRTC)"}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-xl text-slate-300 transition-colors cursor-pointer"
            title="Share this link with colleagues to join"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Link Copied!" : "Copy Meet Link"}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Video Stream Area + Collaborative Side Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Video Tiles Grid */}
        <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto">
          <div className={`grid gap-4 flex-1 ${
            remotePeers.size === 0
              ? "grid-cols-1 md:grid-cols-2"
              : remotePeers.size === 1
              ? "grid-cols-1 md:grid-cols-2"
              : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
          }`}>
            {/* Local Video Tile */}
            <div className="relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-lg min-h-[240px]">
              {isVideoOn ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-xl font-bold">
                    You
                  </div>
                  <span className="text-xs text-slate-400 font-medium">Camera Off</span>
                </div>
              )}
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-lg text-xs font-medium text-white flex items-center gap-1.5">
                <span>You ({isAudioOn ? "Mic On" : "Muted"})</span>
              </div>
            </div>

            {/* Remote Peers Grid */}
            {Array.from(remotePeers.entries()).map(([peerId, peer]) => (
              <RemoteVideoTile
                key={peerId}
                peerId={peerId}
                name={peer.name}
                stream={peer.stream}
              />
            ))}

            {/* If solo in the room, show invite tile */}
            {remotePeers.size === 0 && (
              <div className="relative bg-slate-900/60 rounded-2xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center p-6 text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                  <Users className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Ready for Colleagues to Join</h4>
                  <p className="text-xs text-slate-400 max-w-xs mt-1">
                    Send the link to anyone in your organisation. Both computers will connect with live video, audio, and screen sharing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Link Copied to Clipboard" : "Copy Meet Link"}</span>
                </button>
              </div>
            )}
          </div>

          {/* Call Controls Bar */}
          <div className="flex items-center justify-center gap-3 pt-6">
            <button
              onClick={toggleAudio}
              className={`p-3.5 rounded-2xl transition-all shadow-md cursor-pointer ${
                isAudioOn ? "bg-slate-800 hover:bg-slate-700 text-white" : "bg-rose-600 text-white"
              }`}
              title={isAudioOn ? "Mute Microphone" : "Unmute Microphone"}
            >
              {isAudioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>

            <button
              onClick={toggleVideo}
              className={`p-3.5 rounded-2xl transition-all shadow-md cursor-pointer ${
                isVideoOn ? "bg-slate-800 hover:bg-slate-700 text-white" : "bg-rose-600 text-white"
              }`}
              title={isVideoOn ? "Turn Camera Off" : "Turn Camera On"}
            >
              {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>

            <button
              onClick={toggleScreenShare}
              className={`p-3.5 rounded-2xl transition-all shadow-md cursor-pointer ${
                isScreenSharing ? "bg-indigo-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-slate-300"
              }`}
              title={isScreenSharing ? "Stop Screen Sharing" : "Share Your Screen"}
            >
              <ScreenShare className="w-5 h-5" />
            </button>

            <button
              onClick={() => router.push("/app/meetings")}
              className="p-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-md cursor-pointer"
              title="Leave Call"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Right: Collaborative Side Panel */}
        <div className="w-80 md:w-96 border-l border-slate-800 bg-slate-900/50 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("actions")}
              className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "actions"
                  ? "border-indigo-500 text-white bg-slate-800/40"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Actions</span>
            </button>
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "chat"
                  ? "border-indigo-500 text-white bg-slate-800/40"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
            </button>
            <button
              onClick={() => setActiveTab("notes")}
              className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "notes"
                  ? "border-indigo-500 text-white bg-slate-800/40"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Notes</span>
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col">
            {activeTab === "actions" && (
              <div className="flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Meeting Action Items</span>
                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-300 font-mono">
                      {actionItems.length}
                    </span>
                  </div>

                  {actionItems.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      No action items assigned yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {actionItems.map((item, idx) => (
                        <div key={idx} className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs space-y-1">
                          <p className="font-semibold text-white">{item.title}</p>
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>Assignee: {item.assignee_name || "Unassigned"}</span>
                            <span className="text-amber-400 font-medium capitalize">{item.priority || "Medium"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleAddActionItem} className="pt-2 space-y-2">
                    <input
                      type="text"
                      value={newActionTitle}
                      onChange={(e) => setNewActionTitle(e.target.value)}
                      placeholder="Add an action item…"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newActionAssignee}
                        onChange={(e) => setNewActionAssignee(e.target.value)}
                        placeholder="Assignee (e.g. Lead Dev)"
                        className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-xl text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </form>
                </div>

                <div className="pt-4 border-t border-slate-800 mt-4 space-y-2">
                  {convertedNotice && (
                    <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs">
                      {convertedNotice}
                    </div>
                  )}
                  <button
                    onClick={handleConvertActionItems}
                    disabled={converting || actionItems.length === 0}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    {converting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>Convert Actions to Titan Tasks</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === "chat" && (
              <div className="flex-1 flex flex-col justify-between">
                <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-semibold text-slate-300">{msg.sender}</span>
                        <span>{msg.time}</span>
                      </div>
                      <p className="text-xs p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-200">
                        {msg.text}
                      </p>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSendChat} className="pt-3 flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Message meeting attendees…"
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {activeTab === "notes" && (
              <div className="flex-1 flex flex-col">
                <textarea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  onBlur={async () => {
                    try {
                      await apiUpdateMeeting(roomCode, { notes: notesText });
                    } catch {}
                  }}
                  placeholder="Collaborative minutes and notes for this conference…"
                  className="w-full flex-1 p-3 bg-slate-800/60 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 resize-none leading-relaxed"
                />
                <span className="text-[10px] text-slate-500 mt-2 block">
                  Autosaves on blur. Visible to all attendees.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

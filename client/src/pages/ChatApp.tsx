import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useMessageNotifications } from "@/hooks/useMessageNotifications";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import { ResizableDivider } from "@/components/ResizableDivider";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { MessageCircle, CheckCircle2, Clock, AlertCircle, Plus, BarChart3, Reply, X, Menu, Settings, Users, ArrowLeft, Trash2, Sparkles, Edit2, MoreVertical, ThumbsUp } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { normalizeName } from "@/../../shared/normalizeNames";

interface Message {
  id: number;
  chatRoomId: number;
  senderId: number;
  content: string;
  replyToId?: number | null;
  createdAt: Date;
  senderName?: string;
}

interface Task {
  id: number;
  taskNumber: number;
  description: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "completed";
  dueDate?: Date;
  createdAt: Date;
  /** Precise completion timestamp when available. */
  completedAt?: Date | null;
  /** Fallback/sort helper; also stamped on other edits. */
  updatedAt?: Date;
  assignedToId?: number;
  assignedToName?: string | null;
  creatorId: number;
}

interface Participant {
  id: number;
  userId: number;
  userName?: string;
  displayName?: string;
  email?: string;
  joinedAt: Date;
}

export default function ChatApp() {
  const { user, loading, identities, needsIdentity, selectIdentity, selecting, logout, isAuthenticated } = useAuth();
  const { notifyNewMessage, setLastMessageCount } = useMessageNotifications();
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionHighlight, setMentionHighlight] = useState(0);
  const messageInputRef = useRef<HTMLInputElement | null>(null);
  const seenMessageIdsRef = useRef<Set<number>>(new Set());
  const bootstrappedNotifyRef = useRef(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesRef = useRef<Message[]>([]);
  const loadingOlderRef = useRef(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [replyingToContent, setReplyingToContent] = useState<string>("");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || user?.name || "");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [mobileView, setMobileView] = useState<"chat" | "rooms" | "participants" | "tasks">("chat");
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [hasUnreadBelow, setHasUnreadBelow] = useState(false);
  const [isUserNearBottom, setIsUserNearBottom] = useState(true);
  const [filterKeyword, setFilterKeyword] = useState("");
  const [filterAssignedTo, setFilterAssignedTo] = useState<string | null>(null);
  const [showCreateRoomDialog, setShowCreateRoomDialog] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [createRoomPassword, setCreateRoomPassword] = useState("");
  const [showDeleteRoomDialog, setShowDeleteRoomDialog] = useState(false);
  const [deleteRoomPassword, setDeleteRoomPassword] = useState("");
  const [roomToDelete, setRoomToDelete] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [weeklySummary, setWeeklySummary] = useState<string>("");
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingDescription, setEditingDescription] = useState<string>("");
  const [summaryStats, setSummaryStats] = useState<any>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const ROOM_PASSWORD = "12345";
  const { widths, isResizing, handleMouseDown } = useResizableColumns();

  // Queries
  const roomsQuery = trpc.chat.rooms.useQuery();
  const messagesQuery = trpc.messages.list.useQuery(
    { chatRoomId: selectedRoom || 0, limit: 50 },
    {
      enabled: !!selectedRoom,
      // Initial page only — older history + polling are manual to preserve infinite-scroll state.
      refetchOnWindowFocus: false,
      staleTime: 5_000,
    }
  );
  const tasksQuery = trpc.tasks.list.useQuery(
    { chatRoomId: selectedRoom || 0 },
    { enabled: !!selectedRoom }
  );
  const participantsQuery = trpc.chat.getParticipants.useQuery(
    { chatRoomId: selectedRoom || 0 },
    { enabled: !!selectedRoom }
  );

  const reactionsQuery = trpc.messages.reactions.useQuery(
    {
      chatRoomId: selectedRoom || 0,
      messageIds: messages.map((m) => m.id),
    },
    {
      enabled: !!selectedRoom && messages.length > 0,
      staleTime: 3_000,
      refetchOnWindowFocus: false,
    }
  );

  // Utils
  const utils = trpc.useUtils();
  const toggleThumbsUpMutation = trpc.messages.toggleThumbsUp.useMutation({
    onSuccess: async () => {
      await utils.messages.reactions.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Não foi possível reagir");
    },
  });

  // Mutations
  const sendMessageMutation = trpc.messages.send.useMutation();
  const createRoomMutation = trpc.chat.createRoom.useMutation();
  const deleteRoomMutation = trpc.chat.deleteRoom.useMutation();
  const updateTaskMutation = trpc.tasks.updateStatus.useMutation();
  const deleteTaskMutation = trpc.tasks.deleteTask.useMutation({
    onSuccess: async () => {
      await utils.tasks.list.invalidate();
      toast.success("Tarefa excluída com sucesso", {
        duration: 3000,
      });
    },
    onError: (error) => {
      toast.error("Erro ao excluir tarefa", {
        description: error.message,
        duration: 3000,
      });
    },
  });
  const updateDescriptionMutation = trpc.tasks.updateDescription.useMutation({
    onSuccess: async (_, variables) => {
      const task = tasks.find((t) => t.id === variables.taskId);
      await utils.tasks.list.invalidate();
      toast.success(`Tarefa ${task?.taskNumber} atualizada`, {
        description: "Descricao editada com sucesso",
        duration: 3000,
      });
      setEditingTaskId(null);
    },
    onError: (error) => {
      toast.error("Erro ao atualizar tarefa", {
        description: error.message,
        duration: 3000,
      });
    },
  });
  const detectAssignmentMutation = trpc.tasks.detectAssignmentInMessage.useMutation({
    onSuccess: async (data) => {
      // Invalidate cache to force refetch
      await utils.tasks.list.invalidate();
      
      // Show toast for each assignment
      if (data.updated && data.updated.length > 0) {
        for (const update of data.updated) {
          toast.success(`Tarefa ${update.taskNumber} atribuída para ${update.assignedTo}`, {
            duration: 3000,
          });
        }
      }
    },
  });
  const extractTasksMutation = trpc.tasks.extractFromMessage.useMutation({
    onMutate: () => {
      setIsProcessing(true);
    },
    onSettled: () => {
      setIsProcessing(false);
    },
  });
  const interpretResponseMutation = trpc.tasks.interpretResponse.useMutation();
  const detectCompletionMutation = trpc.tasks.detectCompletionInMessage.useMutation({
    onMutate: () => {
      setIsProcessing(true);
    },
    onSuccess: async (result) => {
      if (result.updated && result.updated.length > 0) {
        // Refetch tasks to get updated data
        try {
          await tasksQuery.refetch();
        } catch (refetchError) {
        }
        
        // Show toast notifications for each updated task
        result.updated.forEach((update: any) => {
          const statusLabel = update.newStatus === 'completed' ? '✅ Concluída' : '⏳ Pendente';
          toast.success(`Tarefa ${update.taskNumber} ${statusLabel}`, {
            description: update.reason,
            duration: 3000,
          });
        });
      }
    },
    onSettled: () => {
      setIsProcessing(false);
    },
  });
  const updateProfileMutation = trpc.auth.updateProfile.useMutation();
  const generateSummaryMutation = trpc.summary.generate.useMutation({
    onMutate: () => {
      setIsGeneratingSummary(true);
    },
    onSuccess: (data) => {
      setWeeklySummary(data.summary);
      setSummaryStats(data.stats);
      setShowSummaryModal(true);
      toast.success("Resumo semanal gerado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao gerar resumo: " + error.message);
    },
    onSettled: () => {
      setIsGeneratingSummary(false);
    },
  });

  // Handle window resize for mobile responsiveness
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Initialize first room
  useEffect(() => {
    if (roomsQuery.data && roomsQuery.data.length > 0 && !selectedRoom) {
      setSelectedRoom(roomsQuery.data[0].id);
      if (isMobile) {
        setMobileView("chat");
      }
    }
  }, [roomsQuery.data, selectedRoom, isMobile]);

  // Keep ref aligned for polling matching without stale closures
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const normalizeMessage = (msg: any): Message => ({
    ...msg,
    createdAt: new Date(msg.createdAt),
  });

  const mergeMessages = (current: Message[], incoming: Message[]) => {
    if (!incoming.length) return current;
    const map = new Map<number, Message>();
    for (const m of current) map.set(m.id, m);
    for (const m of incoming) map.set(m.id, m);
    return Array.from(map.values()).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id
    );
  };

  // Initial page (latest N) when room query settles — chronological order from API.
  useEffect(() => {
    if (!messagesQuery.data || !selectedRoom) return;
    const page = messagesQuery.data as any;
    // Backward-compat: old API returned Message[]; new API returns {items,hasMore,...}
    const itemsRaw = Array.isArray(page) ? [...page].reverse() : page.items || [];
    const items = itemsRaw.map(normalizeMessage);
    setMessages(items);
    setHasMoreOlder(Array.isArray(page) ? items.length >= 50 : Boolean(page.hasMore));
    setIsLoadingMessages(false);
  }, [messagesQuery.data, selectedRoom]);

  useEffect(() => {
    setIsLoadingMessages(Boolean(selectedRoom) && messagesQuery.isLoading);
  }, [selectedRoom, messagesQuery.isLoading]);

  // Update tasks when query changes
  useEffect(() => {
    if (tasksQuery.data) {
      setTasks(
        tasksQuery.data.map((task: any) => ({
          ...task,
          createdAt: new Date(task.createdAt),
          completedAt: task.completedAt ? new Date(task.completedAt) : null,
          updatedAt: task.updatedAt ? new Date(task.updatedAt) : undefined,
          dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
        }))
      );
    }
  }, [tasksQuery.data]);

  // Update participants
  useEffect(() => {
    if (participantsQuery.data) {
      setParticipants(
        participantsQuery.data.map((p: any) => ({
          ...p,
          joinedAt: new Date(p.joinedAt),
        }))
      );
    }
  }, [participantsQuery.data]);

  // Scroll to bottom helper function
  const scrollToBottom = (smooth = false) => {
    const viewport = scrollContainerRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement;

    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto'
        });
      });
    }
  };

  // Check if user is near bottom
  const checkIfNearBottom = () => {
    const viewport = scrollContainerRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement;

    if (!viewport) return true;

    const threshold = 100; // pixels from bottom
    const isNear = viewport.scrollHeight - (viewport.scrollTop + viewport.clientHeight) < threshold;
    setIsUserNearBottom(isNear);
    setHasUnreadBelow(!isNear && messages.length > 0);
  };

  // Auto scroll to bottom when messages change and user is near bottom
  useEffect(() => {
    if (isUserNearBottom) {
      // Use smooth scroll when user is already near bottom
      scrollToBottom(true);
    } else if (messages.length > 0) {
      setHasUnreadBelow(true);
    }
  }, [messages, isUserNearBottom]);

  // Scroll listener: bottom tracking + infinite history at top
  useEffect(() => {
    const viewport = scrollContainerRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement;

    if (!viewport) return;

    const handleScroll = () => {
      checkIfNearBottom();
      if (viewport.scrollTop < 80) {
        void loadOlderMessages();
      }
    };

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [messages, hasMoreOlder, selectedRoom]);

  // Reset mention UI when room changes
  useEffect(() => {
    closeMentionMenu();
    seenMessageIdsRef.current = new Set();
    bootstrappedNotifyRef.current = false;
  }, [selectedRoom]);

  // Signal replies-to-you and @mentions (no schema changes; plain-text @Name)
  useEffect(() => {
    if (!user || messages.length === 0) return;

    // First paint after load/history: mark all visible as seen (no toast spam)
    if (!bootstrappedNotifyRef.current) {
      for (const m of messages) seenMessageIdsRef.current.add(m.id);
      bootstrappedNotifyRef.current = true;
      setLastMessageCount(messages.length);
      return;
    }

    const fresh = messages.filter((m) => !seenMessageIdsRef.current.has(m.id));
    if (!fresh.length) {
      setLastMessageCount(messages.length);
      return;
    }
    for (const m of fresh) seenMessageIdsRef.current.add(m.id);
    setLastMessageCount(messages.length);

    for (const msg of fresh) {
      if (msg.senderId === user.id) continue;
      const senderLabel = msg.senderName || getUserDisplayName(msg.senderId);
      const preview = msg.content.substring(0, 80);
      const mentioned = messageMentionsMe(msg.content);
      const replied = isReplyToMe(msg);

      if (mentioned && replied) {
        toast.message(`${senderLabel} respondeu e mencionou você`, {
          description: preview,
          duration: 5000,
        });
        notifyNewMessage(senderLabel, preview);
      } else if (mentioned) {
        toast.message(`${senderLabel} mencionou você`, {
          description: preview,
          duration: 5000,
        });
        notifyNewMessage(senderLabel, `mencionou você: ${preview}`);
      } else if (replied) {
        toast.message(`${senderLabel} respondeu sua mensagem`, {
          description: preview,
          duration: 5000,
        });
        notifyNewMessage(senderLabel, `respondeu você: ${preview}`);
      } else {
        // keep soft general notify for other chat traffic
        notifyNewMessage(senderLabel, preview);
      }
    }
  }, [messages, user?.id, user?.displayName, displayName, notifyNewMessage, setLastMessageCount]);
  // Reset chat state when switching rooms
  useEffect(() => {
    setMessages([]);
    setHasMoreOlder(false);
    setIsLoadingOlder(false);
    loadingOlderRef.current = false;
    setHasUnreadBelow(false);
    setIsUserNearBottom(true);
    setFilterKeyword("");
    setFilterAssignedTo(null);
    setTimeout(() => {
      scrollToBottom(false);
    }, 120);
  }, [selectedRoom]);

  const loadOlderMessages = async () => {
    if (!selectedRoom || loadingOlderRef.current || !hasMoreOlder) return;
    const oldest = messagesRef.current[0];
    if (!oldest) return;

    const viewport = scrollContainerRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement | null;
    const prevHeight = viewport?.scrollHeight ?? 0;
    const prevTop = viewport?.scrollTop ?? 0;

    loadingOlderRef.current = true;
    setIsLoadingOlder(true);
    try {
      const page: any = await utils.messages.list.fetch({
        chatRoomId: selectedRoom,
        limit: 50,
        beforeId: oldest.id,
        beforeCreatedAt: oldest.createdAt,
      });
      const items = (page.items || []).map(normalizeMessage);
      setMessages((curr) => mergeMessages(curr, items));
      setHasMoreOlder(Boolean(page.hasMore));
      // Preserve visual position after prepending history
      requestAnimationFrame(() => {
        const vp = scrollContainerRef.current?.querySelector(
          '[data-radix-scroll-area-viewport]'
        ) as HTMLDivElement | null;
        if (!vp) return;
        const delta = vp.scrollHeight - prevHeight;
        vp.scrollTop = prevTop + delta;
      });
    } catch (error) {
      console.error('[Chat] failed to load older messages', error);
    } finally {
      loadingOlderRef.current = false;
      setIsLoadingOlder(false);
    }
  };

  // Poll only NEW messages + tasks/participants (does not wipe older history loaded by scroll)
  useEffect(() => {
    if (!selectedRoom) return;

    const interval = setInterval(async () => {
      try {
        const latest = messagesRef.current[messagesRef.current.length - 1];
        if (latest) {
          const page: any = await utils.messages.list.fetch({
            chatRoomId: selectedRoom,
            limit: 50,
            afterId: latest.id,
            afterCreatedAt: latest.createdAt,
          });
          const items = (page.items || []).map(normalizeMessage);
          if (items.length) {
            setMessages((curr) => mergeMessages(curr, items));
            void utils.messages.reactions.invalidate();
          }
        } else {
          // No local messages yet — refresh initial page
          await messagesQuery.refetch();
        }
        tasksQuery.refetch();
        participantsQuery.refetch();
      } catch {
        // ignore transient poll errors
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [selectedRoom, utils, messagesQuery, tasksQuery, participantsQuery]);

  // Sincronizar displayName do usuário ao carregar
  useEffect(() => {
    if (user?.displayName && displayName !== user.displayName) {
      setDisplayName(user.displayName);
    }
  }, [user?.displayName]);

  // Função para obter nome do usuário
  const getUserDisplayName = (userId: number, fallbackName?: string | null): string => {
    if (fallbackName && fallbackName.trim()) return fallbackName.trim();
    const participant = participants.find(p => p.userId === userId);
    return participant?.displayName || participant?.userName || "Usuário";
  };

  const getMessageSenderLabel = (msg: Message): string => {
    if (user && msg.senderId === user.id) return "Você";
    return getUserDisplayName(msg.senderId, msg.senderName);
  };

  // Função para obter a mensagem respondida
  const getRepliedMessage = (replyToId: number): Message | undefined => {
    return messages.find(m => m.id === replyToId);
  };

  type MentionCandidate = { id: number; name: string };

  const getMentionCandidates = (): MentionCandidate[] => {
    const map = new Map<number, MentionCandidate>();
    for (const p of participants) {
      const name = (p.displayName || p.userName || "").trim();
      if (!p.userId || !name) continue;
      // Allow mentioning yourself rarely? Skip for noise.
      if (user?.id && p.userId === user.id) continue;
      map.set(p.userId, { id: p.userId, name });
    }
    // Fallback: people seen as message senders if participants incomplete
    for (const m of messages) {
      if (user?.id && m.senderId === user.id) continue;
      if (map.has(m.senderId)) continue;
      const name = (m.senderName || "").trim();
      if (!name) continue;
      map.set(m.senderId, { id: m.senderId, name });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  };

  const filteredMentionCandidates = (() => {
    const all = getMentionCandidates();
    const q = mentionQuery.trim().toLowerCase();
    if (!q) return all.slice(0, 8);
    return all
      .filter((c) => c.name.toLowerCase().includes(q) || normalizeName(c.name).includes(normalizeName(q)))
      .slice(0, 8);
  })();

  const myMentionTokens = (() => {
    const labels = new Set<string>();
    const add = (v?: string | null) => {
      const s = (v || "").trim();
      if (!s) return;
      labels.add(s.toLowerCase());
      labels.add(normalizeName(s));
      // first name helpers
      const first = s.split(/\s+/)[0];
      if (first) {
        labels.add(first.toLowerCase());
        labels.add(normalizeName(first));
      }
    };
    add(user?.displayName);
    add(user?.name);
    add(displayName);
    return Array.from(labels).filter(Boolean);
  })();

  const messageMentionsMe = (content: string) => {
    if (!content || myMentionTokens.length === 0) return false;
    // Match @Name with letters/accents/spaces until punctuation
    const re = /@([A-Za-zÀ-ÿ0-9._-][A-Za-zÀ-ÿ0-9._\-\s]{0,60})/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
      const raw = match[1].trim().replace(/[.,!?;:]+$/g, "");
      const low = raw.toLowerCase();
      const norm = normalizeName(raw);
      for (const token of myMentionTokens) {
        if (!token) continue;
        if (low === token || norm === token) return true;
        if (low.startsWith(token + " ") || norm.startsWith(token + " ")) return true;
        // "@Larissa" matches display "Larissa Cortez"
        if (token.startsWith(low) || token.startsWith(norm)) return true;
      }
    }
    return false;
  };

  const closeMentionMenu = () => {
    setMentionOpen(false);
    setMentionQuery("");
    setMentionStart(null);
    setMentionHighlight(0);
  };

  const updateMentionFromInput = (value: string, caret: number) => {
    // Find active @ token just before caret
    const left = value.slice(0, caret);
    const at = left.lastIndexOf("@");
    if (at < 0) {
      closeMentionMenu();
      return;
    }
    // '@' must start token (start or whitespace before)
    if (at > 0 && !/\s/.test(left[at - 1])) {
      closeMentionMenu();
      return;
    }
    const fragment = left.slice(at + 1);
    // stop if space-only finished mention or newline
    if (/[\n]/.test(fragment)) {
      closeMentionMenu();
      return;
    }
    // If fragment has ending punctuation only, still allow typing query without trailing space end
    if (/\s{2,}/.test(fragment)) {
      closeMentionMenu();
      return;
    }
    // Close when user typed a completed mention (space after a chosen longer name) — keep open while query short
    setMentionOpen(true);
    setMentionStart(at);
    setMentionQuery(fragment);
    setMentionHighlight(0);
  };

  const applyMention = (candidate: MentionCandidate) => {
    if (mentionStart == null) return;
    const input = messageInputRef.current;
    const caret = input?.selectionStart ?? messageInput.length;
    const before = messageInput.slice(0, mentionStart);
    const after = messageInput.slice(caret);
    // Store as @First Last with trailing space for continuous typing
    const insertion = `@${candidate.name} `;
    const next = `${before}${insertion}${after}`;
    setMessageInput(next);
    closeMentionMenu();
    requestAnimationFrame(() => {
      const el = messageInputRef.current;
      if (!el) return;
      const pos = before.length + insertion.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const handleComposerChange = (value: string, caret: number) => {
    setMessageInput(value);
    updateMentionFromInput(value, caret);
  };

  const handleComposerKeyDown = (e: import("react").KeyboardEvent<HTMLInputElement>) => {
    if (mentionOpen && filteredMentionCandidates.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionHighlight((i) => (i + 1) % filteredMentionCandidates.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionHighlight((i) => (i - 1 + filteredMentionCandidates.length) % filteredMentionCandidates.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        applyMention(filteredMentionCandidates[mentionHighlight] || filteredMentionCandidates[0]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeMentionMenu();
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const renderMessageContent = (content: string) => {
    // Highlight @mentions visually (text remains plain in DB)
    const nodes: import("react").ReactNode[] = [];
    const re = /@([A-Za-zÀ-ÿ0-9._-][A-Za-zÀ-ÿ0-9._\-\s]{0,60})/g;
    let last = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = re.exec(content)) !== null) {
      const start = match.index;
      if (start > last) nodes.push(content.slice(last, start));
      const full = match[0];
      // trim trailing punctuation from highlight width but keep in text
      const cleaned = full.replace(/[.,!?;:]+$/g, "");
      const trailing = full.slice(cleaned.length);
      nodes.push(
        <span
          key={`m-${key++}`}
          className="rounded px-0.5 font-medium text-teal-800 bg-teal-50/90"
        >
          {cleaned}
        </span>
      );
      if (trailing) nodes.push(trailing);
      last = start + full.length;
    }
    if (last < content.length) nodes.push(content.slice(last));
    return nodes.length ? nodes : content;
  };

  const isReplyToMe = (msg: Message) => {
    if (!user || !msg.replyToId) return false;
    const parent = getRepliedMessage(msg.replyToId);
    return Boolean(parent && parent.senderId === user.id);
  };

  const mentionDropdown = mentionOpen && filteredMentionCandidates.length > 0 ? (
    <div className="absolute bottom-full left-0 right-12 mb-1 z-30 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md">
      <div className="px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400 border-b border-slate-100">
        Mencionar
      </div>
      <ul className="max-h-48 overflow-y-auto py-1">
        {filteredMentionCandidates.map((c, idx) => (
          <li key={c.id}>
            <button
              type="button"
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                idx === mentionHighlight ? "bg-teal-50 text-teal-900" : "text-slate-700 hover:bg-slate-50"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                applyMention(c);
              }}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                {c.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="truncate font-medium">{c.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  ) : null;

  // Função para filtrar tarefas
  const getFilteredTasks = (taskList: Task[]) => {
    return taskList.filter(task => {
      // Filtro por usuário responsável (com normalização de nomes)
      if (filterAssignedTo) {
        const filterValueNormalized = normalizeName(String(filterAssignedTo));
        const taskAssignedNameNormalized = task.assignedToName ? normalizeName(task.assignedToName) : '';
        
        // Se o filtro de responsável está ativo, a tarefa DEVE corresponder
        if (taskAssignedNameNormalized !== filterValueNormalized) {
          return false;
        }
      }
      
      // Filtro por palavra-chave (busca na descrição)
      if (filterKeyword.trim()) {
        const keyword = filterKeyword.toLowerCase();
        if (!task.description.toLowerCase().includes(keyword)) {
          return false;
        }
      }
      
      // Se passou em todos os filtros, inclui a tarefa
      return true;
    });
  };

  // Tarefas filtradas
  const filteredTasks = getFilteredTasks(tasks);

  /** Completed list only: most recently completed first. Pending order unchanged. */
  const getCompletedTasksNewestFirst = (taskList: Task[]) =>
    [...taskList]
      .filter((t) => t.status === "completed")
      .sort((a, b) => {
        const aTime = (a.completedAt ?? a.updatedAt ?? a.createdAt).getTime();
        const bTime = (b.completedAt ?? b.updatedAt ?? b.createdAt).getTime();
        if (bTime !== aTime) return bTime - aTime;
        return b.id - a.id;
      });


  type ThumbsSummary = {
    messageId: number;
    count: number;
    reactedByMe: boolean;
    users: string[];
  };

  const getThumbsSummary = (messageId: number): ThumbsSummary => {
    const rows = (reactionsQuery.data || []) as ThumbsSummary[];
    const found = rows.find((r) => r.messageId === messageId);
    return found || { messageId, count: 0, reactedByMe: false, users: [] };
  };

  const handleToggleThumbsUp = (messageId: number) => {
    if (!user) {
      toast.message("Selecione sua identidade para reagir");
      return;
    }
    toggleThumbsUpMutation.mutate({ messageId });
  };

  const renderThumbsUpControls = (msg: Message) => {
    const summary = getThumbsSummary(msg.id);
    const mine = summary.reactedByMe;
    const isOwn = msg.senderId === user?.id;
    const title =
      summary.users.length > 0
        ? summary.users.join(", ")
        : mine
          ? "Remover joinha"
          : "Dar joinha";

    return (
      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleToggleThumbsUp(msg.id);
          }}
          disabled={toggleThumbsUpMutation.isPending}
          title={title}
          aria-label={mine ? "Remover joinha" : "Dar joinha"}
          aria-pressed={mine}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
            mine
              ? isOwn
                ? "border-white/40 bg-white/15 text-white"
                : "border-teal-300 bg-teal-50 text-teal-800"
              : isOwn
                ? "border-white/25 bg-white/10 text-teal-50 hover:bg-white/20"
                : "border-slate-200 bg-white text-slate-500 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50"
          }`}
        >
          <ThumbsUp className={`w-3 h-3 ${mine ? "fill-current" : ""}`} />
          {summary.count > 0 ? (
            <span className="tabular-nums">{summary.count}</span>
          ) : (
            <span className="opacity-80">Joinha</span>
          )}
        </button>
      </div>
    );
  };

  const formatMessageTimestamp = (value: Date | string) => {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (sameDay) return time;
    const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    return `${date} ${time}`;
  };

  const currentIdentityLabel = user?.displayName || user?.name || "Usuário";
  const currentIdentityInitial = (currentIdentityLabel || "U").slice(0, 1).toUpperCase();

  const roomMenu = (roomId: number) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          title="Opções da sala"
          aria-label="Opções da sala"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          className="text-red-600 focus:text-red-700 focus:bg-red-50"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteRoom(roomId);
          }}
        >
          <Trash2 className="w-4 h-4" />
          Excluir sala
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const taskActionsMenu = (task: Task, opts?: { withEdit?: boolean }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
          title="Mais ações"
          aria-label="Mais ações da tarefa"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {opts?.withEdit !== false && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setEditingTaskId(task.id);
              setEditingDescription(task.description);
            }}
          >
            <Edit2 className="w-4 h-4" />
            Editar
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="text-red-600 focus:text-red-700 focus:bg-red-50"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Tem certeza que deseja excluir a Tarefa ${task.taskNumber}?`)) {
              deleteTaskMutation.mutateAsync({ taskId: task.id });
            }
          }}
        >
          <Trash2 className="w-4 h-4" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const identityChip = (
    <button
      type="button"
      onClick={() => setShowProfileModal(true)}
      className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-left hover:bg-slate-50 transition-colors max-w-[180px]"
      title="Perfil e identidade"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-800">
        {currentIdentityInitial}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-slate-800">{currentIdentityLabel}</span>
        <span className="block text-[10px] text-slate-400">Trocar / perfil</span>
      </span>
    </button>
  );

  const formatTaskDate = (value?: Date | null) => {
    if (!value) return "—";
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  };

  /** Compact metadata row under task title (minimal, same pattern pending/completed). */
  const renderTaskDates = (task: Task, opts?: { showCompleted?: boolean }) => {
    const showCompleted = Boolean(opts?.showCompleted);
    const completed =
      task.completedAt ?? (task.status === "completed" ? task.updatedAt : null);

    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-4 text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="text-slate-400">Criada</span>
          <span className="font-medium text-slate-600 tabular-nums">{formatTaskDate(task.createdAt)}</span>
        </span>
        {showCompleted && (
          <>
            <span className="text-slate-300" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-400">Concluída</span>
              <span className="font-medium text-slate-600 tabular-nums">{formatTaskDate(completed)}</span>
            </span>
          </>
        )}
      </div>
    );
  };

  // Função para obter usuário por ID
  const getUserById = (userId: number) => {
    return participants.find(p => p.userId === userId);
  };

  // Função para obter lista única de responsáveis (participantes + atribuídos às tarefas)
  const getUniqueResponsibles = () => {
    const responsibles = new Map();
    
    // Adicionar participantes - usar nome em minúscula como chave para evitar duplicatas
    participants.forEach(p => {
      if (p.userId && p.displayName) {
        const key = p.displayName.toLowerCase();
        responsibles.set(key, { id: p.userId, name: p.displayName });
      }
    });
    
    // Adicionar responsáveis já atribuídos às tarefas
    tasks.forEach(task => {
      if (task.assignedToName) {
        const key = task.assignedToName.toLowerCase();
        if (!responsibles.has(key)) {
          responsibles.set(key, { 
            id: task.assignedToId || task.assignedToName, 
            name: task.assignedToName 
          });
        }
      }
    });
    
    return Array.from(responsibles.values()).sort((a, b) => 
      String(a.name).localeCompare(String(b.name))
    );
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high":
        return "Alta";
      case "medium":
        return "Média";
      case "low":
        return "Baixa";
      default:
        return priority;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "Concluída";
      case "pending":
        return "Pendente";
      case "cancelled":
        return "Cancelada";
      default:
        return status;
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedRoom) return;

    // Validar se usuário tem nome definido
    if (!displayName || !displayName.trim()) {
      alert("Por favor, defina seu nome no perfil antes de enviar mensagens.");
      setShowProfileModal(true);
      return;
    }

    const messageContent = messageInput;
    const replyId = replyingToId;
    const chatRoomId = selectedRoom;

    try {
      // Enviar mensagem imediatamente (não esperar análises)
      const result = await sendMessageMutation.mutateAsync({
        chatRoomId: chatRoomId,
        content: messageContent,
        replyToId: replyId || undefined,
      });

      // Limpar input imediatamente
      setMessageInput("");
      closeMentionMenu();
      setReplyingToId(null);
      setReplyingToContent("");

      // Scroll to bottom
      setTimeout(() => {
        setIsUserNearBottom(true);
        scrollToBottom(true);
      }, 100);

      // Refresh tasks/participants; messages are polled without wiping older history
      tasksQuery.refetch();
      participantsQuery.refetch();
      // Pull newest messages/after-send rows
      try {
        const latest = messagesRef.current[messagesRef.current.length - 1];
        const page: any = await utils.messages.list.fetch({
          chatRoomId,
          limit: 20,
          ...(latest
            ? { afterId: latest.id, afterCreatedAt: latest.createdAt }
            : {}),
        });
        const items = (page.items || []).map(normalizeMessage);
        if (items.length) setMessages((curr) => mergeMessages(curr, items));
        else if (!latest) await messagesQuery.refetch();
      } catch {
        await messagesQuery.refetch();
      }

      // Executar análises de LLM em background (não-bloqueante)
      // Usar Promise.allSettled para executar em paralelo
      const llmTasks = [];

      // Tarefa 1: Interpretar resposta (se for resposta)
      if (replyId) {
        const repliedMessage = messages.find(m => m.id === replyId);
        if (repliedMessage) {
          const possibleTask = tasks.find(t => t.description.includes(repliedMessage.content.substring(0, 50)));
          if (possibleTask) {
            llmTasks.push(
              interpretResponseMutation.mutateAsync({
                taskId: possibleTask.id,
                responseContent: messageContent,
                messageId: (result as any).insertId || 0,
              }).catch(() => {})
            );
          }
        }
      }

      // Tarefa 2: Extrair tarefas
      llmTasks.push(
        extractTasksMutation.mutateAsync({
          messageContent: messageContent,
          chatRoomId: chatRoomId,
        }).catch(() => {})
      );

      // Tarefa 3: Detectar conclusão
      llmTasks.push(
        detectCompletionMutation.mutateAsync({
          chatRoomId: chatRoomId,
          messageContent: messageContent,
        }).catch(() => {})
      );

      // Tarefa 4: Detectar atribuição
      llmTasks.push(
        detectAssignmentMutation.mutateAsync({
          chatRoomId: chatRoomId,
          messageContent: messageContent,
        }).catch(() => {})
      );

      // Executar em background sem esperar
      Promise.allSettled(llmTasks).then(() => {
        // Don't full-refetch messages (would drop infinite-scroll history).
        tasksQuery.refetch();
        participantsQuery.refetch();
      }).catch(() => {});

    } catch (error) {
      alert(`Erro ao enviar mensagem: ${error instanceof Error ? error.message : 'Desconhecido'}`);
    }
  };

  const handleCreateRoom = () => {
    setShowCreateRoomDialog(true);
  };

  const handleConfirmCreateRoom = async () => {
    if (!newRoomName.trim()) {
      alert("Digite um nome para a sala");
      return;
    }
    if (!createRoomPassword.trim()) {
      alert("Digite a senha");
      return;
    }
    if (createRoomPassword !== ROOM_PASSWORD) {
      alert("Senha incorreta");
      return;
    }
    try {
      await createRoomMutation.mutateAsync({
        name: newRoomName.trim(),
        description: "",
        password: createRoomPassword,
      });
      setNewRoomName("");
      setCreateRoomPassword("");
      setShowCreateRoomDialog(false);
      await new Promise(resolve => setTimeout(resolve, 1000));
      await roomsQuery.refetch();
    } catch (error) {
      alert(`Erro ao criar sala: ${error instanceof Error ? error.message : 'Desconhecido'}`);
    }
  };

  const handleDeleteRoom = (roomId: number) => {
    setRoomToDelete(roomId);
    setShowDeleteRoomDialog(true);
  };

  const handleConfirmDeleteRoom = async () => {
    if (!deleteRoomPassword.trim()) {
      alert("Digite a senha");
      return;
    }
    if (deleteRoomPassword !== ROOM_PASSWORD) {
      alert("Senha incorreta");
      return;
    }
    if (!roomToDelete) return;
    try {
      await deleteRoomMutation.mutateAsync({
        chatRoomId: roomToDelete,
        password: deleteRoomPassword,
      });
      setDeleteRoomPassword("");
      setShowDeleteRoomDialog(false);
      setRoomToDelete(null);
      if (selectedRoom === roomToDelete) {
        setSelectedRoom(null);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      await roomsQuery.refetch();
    } catch (error) {
      alert(`Erro ao excluir sala: ${error instanceof Error ? error.message : 'Desconhecido'}`);
    }
  };

  const handleToggleTask = async (taskId: number, currentStatus: string) => {
    const newStatus =
      currentStatus === "completed" ? "pending" : "completed";
    try {
      await updateTaskMutation.mutateAsync({
        taskId,
        status: newStatus as any,
      });
      tasksQuery.refetch();
    } catch (error) {
    }
  };

  const handleUpdateProfile = async () => {
    if (!displayName.trim()) return;
    if (!user) {
      toast.error("Selecione sua identidade antes de atualizar o perfil.");
      return;
    }
    try {
      await updateProfileMutation.mutateAsync({
        displayName: displayName.trim(),
      });
      setShowProfileModal(false);
      await utils.auth.me.invalidate();
      participantsQuery.refetch();
      toast.success("Perfil atualizado com sucesso!", {
        duration: 3000,
      });
    } catch (error) {
      toast.error(`Erro ao atualizar perfil: ${error instanceof Error ? error.message : 'Desconhecido'}`, {
        duration: 3000,
      });
    }
  };

  const handleSelectIdentity = async (userId: number) => {
    try {
      const selected = await selectIdentity(userId);
      const label = selected.displayName || selected.name || "Usuário";
      setDisplayName(label);
      toast.success(`Identidade: ${label}`);
      roomsQuery.refetch();
    } catch (error) {
      toast.error(`Erro ao selecionar identidade: ${error instanceof Error ? error.message : "Desconhecido"}`);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case "pending":
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Restore multi-user access without creating new people:
  // each browser picks an EXISTING team identity from the database.
  if (needsIdentity || !isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-xl p-6 shadow-lg border-slate-200">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-teal-700">
              <Users className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">Quem está usando?</h1>
            <p className="mt-2 text-sm text-slate-600">
              Selecione sua identidade existente. Mensagens, tarefas e responsáveis históricos
              serão preservados para as mesmas pessoas.
            </p>
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {identities.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Nenhum usuário encontrado na base. Verifique o <code>DATABASE_URL</code> no Render
                e se a base TiDB ainda contém a tabela <code>users</code>.
              </div>
            ) : (
              identities.map((identity) => (
                <button
                  key={identity.id}
                  type="button"
                  disabled={selecting}
                  onClick={() => handleSelectIdentity(identity.id)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-teal-400 hover:bg-teal-50 disabled:opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                      {(identity.displayName || identity.name || "U").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {identity.displayName || identity.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {identity.email || `ID ${identity.id}`}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {selecting && (
            <p className="mt-4 text-center text-sm text-slate-500">Entrando...</p>
          )}
        </Card>
      </div>
    );
  }

  // MOBILE VIEW
  if (isMobile) {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          {mobileView === "chat" && (
            <>
              <div className="flex-1 min-w-0 pr-2">
                <h1 className="text-base font-semibold text-slate-900 truncate">
                  {roomsQuery.data?.find((r: any) => r.id === selectedRoom)?.name || "Chat"}
                </h1>
                <p className="text-[11px] text-slate-500 truncate">{currentIdentityLabel}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {identityChip}
                <button
                  onClick={() => setShowParticipantsModal(true)}
                  className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Participantes"
                >
                  <Users className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
          {mobileView === "rooms" && (
            <>
              <h1 className="text-base font-semibold text-slate-900 flex-1">Salas</h1>
              <div className="flex items-center gap-1">
                {identityChip}
                <button
                  onClick={() => setMobileView("chat")}
                  className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Voltar ao chat"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
          {mobileView === "tasks" && (
            <>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-semibold text-slate-900">Tarefas</h1>
                <p className="text-[11px] text-slate-500 truncate">{currentIdentityLabel}</p>
              </div>
              {identityChip}
            </>
          )}
        </div>

        {/* Mobile Rooms View */}
        {mobileView === "rooms" && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {roomsQuery.data?.map((room: any) => (
              <div key={room.id} className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setSelectedRoom(room.id);
                    setMobileView("chat");
                  }}
                  className="flex-1 text-left px-4 py-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-none"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageCircle className="w-4 h-4 text-teal-600 shrink-0" />
                    <span className="font-medium text-sm text-slate-900 truncate">{room.name}</span>
                  </div>
                </button>
                {roomMenu(room.id)}
              </div>
            ))}
            <Button
              onClick={handleCreateRoom}
              variant="outline"
              className="w-full mt-4 border-slate-200 text-slate-700 hover:bg-slate-100"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Sala
            </Button>
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-2">
              <p className="px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Mais
              </p>
              <Button
                onClick={() => {
                  if (selectedRoom) {
                    generateSummaryMutation.mutate({ chatRoomId: selectedRoom });
                  } else {
                    toast.error("Selecione uma sala para gerar resumo");
                  }
                }}
                variant="ghost"
                className="w-full justify-start text-slate-700"
                disabled={isGeneratingSummary}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {isGeneratingSummary ? "Gerando..." : "Resumo Semanal"}
              </Button>
              <Button
                onClick={() => (window.location.href = "/report")}
                variant="ghost"
                className="w-full justify-start text-slate-700"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Relatório
              </Button>
              <Button
                onClick={() => setShowProfileModal(true)}
                variant="ghost"
                className="w-full justify-start text-slate-700"
              >
                <Settings className="w-4 h-4 mr-2" />
                Perfil
              </Button>
            </div>
          </div>
        )}

        {/* Mobile Tasks View */}
        {mobileView === "tasks" && selectedRoom && (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {/* Filtros Mobile */}
            <div className="border-b border-slate-200 bg-slate-50 p-3 space-y-3">
              <Input
                placeholder="Buscar tarefa..."
                value={filterKeyword}
                onChange={(e) => setFilterKeyword(e.target.value)}
                className="text-sm"
              />
              <select
                value={filterAssignedTo || ""}
                onChange={(e) => setFilterAssignedTo(e.target.value || null)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white hover:bg-slate-50"
              >
                <option value="">Todos os responsáveis</option>
                {getUniqueResponsibles().map((r: any) => (
                  <option key={r.id ?? r.name} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full p-4">
                <div className="space-y-3">
                  <Tabs defaultValue="pending" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                      <TabsTrigger value="pending">Pendentes</TabsTrigger>
                      <TabsTrigger value="completed">Concluídas</TabsTrigger>
                    </TabsList>
                    <TabsContent value="pending" className="space-y-3">
                      {filteredTasks.filter((t) => t.status !== "completed").length === 0 ? (
                        <p className="text-center text-slate-400 py-8">Nenhuma tarefa pendente</p>
                      ) : (
                        filteredTasks
                          .filter((t) => t.status !== "completed")
                          .map((task) => (
                            <div key={task.id} className="group p-3 border border-slate-200 rounded-lg bg-white w-full shadow-none">
                              {/* Task Content */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 group min-w-0">
                                    {editingTaskId === task.id ? (
                                      <input
                                        type="text"
                                        value={editingDescription}
                                        onChange={(e) => setEditingDescription(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            updateDescriptionMutation.mutateAsync({
                                              taskId: task.id,
                                              description: editingDescription,
                                            });
                                          } else if (e.key === "Escape") {
                                            setEditingTaskId(null);
                                          }
                                        }}
                                        className="flex-1 text-sm font-medium px-2 py-1 border border-teal-400 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        autoFocus
                                      />
                                    ) : (
                                      <p className="text-sm font-medium text-slate-900"><span className="font-bold text-teal-600">Tarefa {task.taskNumber}:</span> {task.description}</p>
                                    )}
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    {task.assignedToName && (
                                      <span className="text-xs text-slate-500">👤 {task.assignedToName}</span>
                                    )}
                                    {renderTaskDates(task)}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <input
                                    type="checkbox"
                                    checked={false}
                                    onChange={() =>
                                      updateTaskMutation.mutateAsync({
                                        taskId: task.id,
                                        status: "completed" as any,
                                      })
                                    }
                                    className="w-4 h-4 rounded border-slate-300"
                                    title="Concluir tarefa"
                                  />
                                  {taskActionsMenu(task)}
                                </div>
                              </div>
                            </div>
                          ))
                      )}
                    </TabsContent>
                    <TabsContent value="completed" className="space-y-3">
                      {getCompletedTasksNewestFirst(filteredTasks).length === 0 ? (
                        <p className="text-center text-slate-400 py-8">Nenhuma tarefa concluída</p>
                      ) : (
                        getCompletedTasksNewestFirst(filteredTasks)
                          .map((task) => (
                            <Card key={task.id} className="p-3 opacity-70 border border-slate-200 shadow-none">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <p className="text-sm font-medium text-slate-900 line-through"><span className="font-bold text-green-600">Tarefa {task.taskNumber}:</span> {task.description}</p>
                                  </div>
                                  {task.assignedToName && (
                                    <span className="text-xs text-slate-500">👤 {task.assignedToName}</span>
                                  )}
                                  {renderTaskDates(task, { showCompleted: true })}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {taskActionsMenu(task, { withEdit: false })}
                                </div>
                              </div>
                            </Card>
                          ))
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        {/* Mobile Chat View */}
        {mobileView === "chat" && selectedRoom && (
          <>
            {/* Messages Area with Scrollbar */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <div className="flex-1 overflow-hidden" ref={scrollContainerRef}>
                <ScrollArea
                  className="h-full p-4"
                >
                  <div className="space-y-5 max-w-full">
                  <div className="flex flex-col items-center gap-2 py-2">
                    {isLoadingOlder && (
                      <div className="text-xs text-slate-500">Carregando histórico…</div>
                    )}
                    {!isLoadingOlder && hasMoreOlder && messages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => void loadOlderMessages()}
                        className="text-xs text-teal-700 hover:text-teal-800 underline"
                      >
                        Carregar mensagens antigas
                      </button>
                    )}
                    {!hasMoreOlder && messages.length > 0 && (
                      <div className="text-[11px] text-slate-400">Início da conversa</div>
                    )}
                    {isLoadingMessages && messages.length === 0 && (
                      <div className="text-xs text-slate-500">Carregando mensagens…</div>
                    )}
                  </div>
                  {messages.length === 0 && !isLoadingMessages ? (
                    <div className="flex items-center justify-center h-full text-slate-400">
                      <p>Nenhuma mensagem ainda. Comece a conversar!</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className="space-y-2">
                        {msg.replyToId && (
                          <div className="ml-8 pl-4 border-l-2 border-slate-300 text-xs text-slate-500">
                            Respondendo a uma mensagem anterior
                          </div>
                        )}
                        <div
                          className={`flex ${
                            msg.senderId === user?.id
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <div
                            className={`group max-w-[85%] sm:max-w-xs px-3.5 py-2.5 rounded-2xl shadow-none ${
                              msg.senderId === user?.id
                                ? "bg-teal-600 text-white rounded-br-md"
                                : messageMentionsMe(msg.content) || isReplyToMe(msg)
                                  ? "bg-white text-slate-900 border border-teal-300 ring-1 ring-teal-100 rounded-bl-md"
                                  : "bg-white text-slate-900 border border-slate-200 rounded-bl-md"
                            }`}
                          >
                            <p className="text-sm font-medium mb-0.5 tracking-tight">
                              {getMessageSenderLabel(msg)}
                            </p>
                            {msg.replyToId && getRepliedMessage(msg.replyToId) && (
                              <div className="mb-2 p-2 bg-opacity-20 bg-slate-400 rounded border-l-2 border-slate-400 text-xs">
                                <p className="font-semibold text-slate-600">Respondendo a:</p>
                                <p className="text-slate-700 break-words">{getRepliedMessage(msg.replyToId)?.content}</p>
                              </div>
                            )}
                            <p className="text-sm leading-relaxed break-words">{renderMessageContent(msg.content)}</p>
                            {(messageMentionsMe(msg.content) || isReplyToMe(msg)) && msg.senderId !== user?.id && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {messageMentionsMe(msg.content) && (
                                  <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200">
                                    mencionou você
                                  </span>
                                )}
                                {isReplyToMe(msg) && (
                                  <span className="inline-flex items-center rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-800 border border-sky-200">
                                    resposta a você
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="flex items-center justify-between mt-2 gap-2">
                              <p
                                className={`text-xs ${
                                  msg.senderId === user?.id
                                    ? "text-teal-100/90"
                                    : "text-slate-500"
                                }`}
                              >
                                {formatMessageTimestamp(msg.createdAt)}
                              </p>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleThumbsUp(msg.id)}
                                  disabled={toggleThumbsUpMutation.isPending}
                                  className={`p-1 rounded transition-opacity ${
                                    getThumbsSummary(msg.id).reactedByMe
                                      ? msg.senderId === user?.id
                                        ? "text-white"
                                        : "text-teal-600"
                                      : msg.senderId === user?.id
                                        ? "text-teal-100/80 hover:text-white opacity-70 md:opacity-0 md:group-hover:opacity-100"
                                        : "text-slate-400 hover:text-teal-600 opacity-70 md:opacity-0 md:group-hover:opacity-100"
                                  }`}
                                  title={getThumbsSummary(msg.id).reactedByMe ? "Remover joinha" : "Dar joinha"}
                                  aria-label="Joinha"
                                >
                                  <ThumbsUp
                                    className={`w-3.5 h-3.5 ${
                                      getThumbsSummary(msg.id).reactedByMe ? "fill-current" : ""
                                    }`}
                                  />
                                </button>
                                <button
                                  onClick={() => {
                                    setReplyingToId(msg.id);
                                    setReplyingToContent(msg.content);
                                  }}
                                  className={`p-1 rounded transition-opacity opacity-70 md:opacity-0 md:group-hover:opacity-100 ${
                                    msg.senderId === user?.id
                                      ? "text-teal-100/80 hover:text-white"
                                      : "text-slate-400 hover:text-slate-600"
                                  }`}
                                  title="Responder"
                                >
                                  <Reply className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            {(getThumbsSummary(msg.id).count > 0 || getThumbsSummary(msg.id).reactedByMe) && (
                              renderThumbsUpControls(msg)
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {isProcessing && (
                    <div className="flex items-center gap-2 p-4 text-slate-600">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                        <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                        <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                      </div>
                      <span className="text-sm font-medium">IA processando...</span>
                    </div>
                  )}
                  </div>
                </ScrollArea>
              </div>

              {/* Unread Messages Indicator - Mobile */}
              {hasUnreadBelow && (
                <div className="border-t border-slate-200 bg-teal-50/80 px-4 py-1.5 flex items-center justify-center">
                  <button
                    onClick={() => {
                      setIsUserNearBottom(true);
                      scrollToBottom(true);
                    }}
                    className="flex items-center gap-2 text-teal-700 hover:text-teal-900 font-medium text-sm transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Novas mensagens abaixo
                  </button>
                </div>
              )}

              {/* Message Input - sticky above tab bar */}
              <div className="border-t border-slate-200 bg-white p-3 flex-shrink-0 sticky bottom-0 z-10">
                {replyingToId && (
                  <div className="mb-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-500 mb-0.5">Respondendo a:</p>
                      <p className="text-sm text-slate-700 truncate">{replyingToContent}</p>
                    </div>
                    <button
                      onClick={() => {
                        setReplyingToId(null);
                        setReplyingToContent("");
                      }}
                      className="ml-2 p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className="relative flex gap-2 items-center">
                  {mentionDropdown}
                  <Input
                    ref={messageInputRef}
                    value={messageInput}
                    onChange={(e) => handleComposerChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
                    onClick={(e) => updateMentionFromInput(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
                    onKeyUp={(e) => updateMentionFromInput(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder="Mensagem… use @ para mencionar"
                    className="flex-1 min-h-11"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim()}
                    className="bg-teal-600 hover:bg-teal-700 text-white shadow-none min-h-11 px-4"
                  >
                    Enviar
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Mobile Bottom Navigation */}
        {isMobile && selectedRoom && (
          <div className="border-t border-slate-200 bg-white flex gap-0 flex-shrink-0 pb-[env(safe-area-inset-bottom)]">
            <button
              onClick={() => setMobileView("chat")}
              className={`flex-1 py-2.5 px-3 text-center text-xs font-medium transition-colors ${
                mobileView === "chat"
                  ? "text-teal-600 border-t-2 border-teal-600"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              <MessageCircle className="w-5 h-5 mx-auto mb-0.5" />
              Chat
            </button>
            <button
              onClick={() => setMobileView("tasks")}
              className={`flex-1 py-2.5 px-3 text-center text-xs font-medium transition-colors ${
                mobileView === "tasks"
                  ? "text-teal-600 border-t-2 border-teal-600"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              <CheckCircle2 className="w-5 h-5 mx-auto mb-0.5" />
              Tarefas
            </button>
            <button
              onClick={() => setMobileView("rooms")}
              className={`flex-1 py-2.5 px-3 text-center text-xs font-medium transition-colors ${
                mobileView === "rooms"
                  ? "text-teal-600 border-t-2 border-teal-600"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              <Menu className="w-5 h-5 mx-auto mb-0.5" />
              Salas
            </button>
          </div>
        )}

        {/* Create Room Dialog - Mobile */}
        {showCreateRoomDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
            <Card className="w-full rounded-t-2xl p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Criar Nova Sala</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Nome da Sala</label>
                  <Input
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="Digite o nome da sala"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Senha</label>
                  <Input
                    type="password"
                    value={createRoomPassword}
                    onChange={(e) => setCreateRoomPassword(e.target.value)}
                    placeholder="Digite a senha"
                    className="w-full"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <Button
                  onClick={() => setShowCreateRoomDialog(false)}
                  variant="outline"
                  className="border-slate-200 text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmCreateRoom}
                  className="bg-teal-600 hover:bg-teal-700 text-white shadow-none"
                >
                  Criar
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Delete Room Dialog - Mobile */}
        {showDeleteRoomDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
            <Card className="w-full rounded-t-2xl p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Excluir Sala</h3>
              <p className="text-sm text-slate-600 mb-4">Você tem certeza que deseja excluir esta sala? Esta ação não pode ser desfeita.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Senha</label>
                  <Input
                    type="password"
                    value={deleteRoomPassword}
                    onChange={(e) => setDeleteRoomPassword(e.target.value)}
                    placeholder="Digite a senha"
                    className="w-full"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <Button
                  onClick={() => setShowDeleteRoomDialog(false)}
                  variant="outline"
                  className="border-slate-200 text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmDeleteRoom}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Excluir
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Participants Modal */}
        {showParticipantsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
            <Card className="w-full rounded-t-2xl p-6 max-h-96 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-900">Participantes ({participants.length})</h3>
                <button
                  onClick={() => setShowParticipantsModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2">
                {participants.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-sm font-bold text-teal-900">
                      {(p.displayName || p.userName || "U")[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{p.displayName || p.userName}</p>
                      <p className="text-xs text-slate-500">{p.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Profile Modal */}
        {showProfileModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
            <Card className="w-full rounded-t-2xl p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Editar Perfil</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nome para exibição no chat
                  </label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Digite seu nome"
                    className="w-full"
                  />
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  Identidade atual: <span className="font-medium text-slate-900">{user?.displayName || user?.name}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2 justify-end">
                    <Button
                      onClick={() => setShowProfileModal(false)}
                      variant="outline"
                      className="border-slate-200 text-slate-700 hover:bg-slate-100"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleUpdateProfile}
                      className="bg-teal-600 hover:bg-teal-700 text-white shadow-none"
                    >
                      Salvar
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-slate-200 text-slate-700 hover:bg-slate-100"
                    onClick={async () => {
                      await logout();
                      setShowProfileModal(false);
                      toast.message("Selecione novamente quem está usando o app");
                    }}
                  >
                    Trocar identidade
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // DESKTOP VIEW
  return (
    <div className="h-screen w-screen flex bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
      {/* Sidebar */}
      <div style={{ width: `${widths.rooms}%` }} className="bg-white border-r border-slate-200 flex flex-col transition-all duration-75 overflow-hidden">
        {/* Adicionar cursor durante redimensionamento */}
        {isResizing && <div className="fixed inset-0 cursor-col-resize z-50" />}
        <div className="p-5 border-b border-slate-200 space-y-3">
          <div className="flex items-center gap-3">
            <img src="/favicon.ico" alt="Chat Atividades" className="w-9 h-9 rounded-lg" />
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold text-slate-900 tracking-tight truncate">Chat Atividades</h1>
              <p className="text-[11px] text-slate-500">Gestão Inteligente</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                  title="Mais"
                  aria-label="Mais opções"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => (window.location.href = "/report")}>
                  <BarChart3 className="w-4 h-4" />
                  Relatório
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isGeneratingSummary || !selectedRoom}
                  onClick={() => {
                    if (!selectedRoom) {
                      toast.error("Selecione uma sala para gerar resumo");
                      return;
                    }
                    generateSummaryMutation.mutate({ chatRoomId: selectedRoom });
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                  {isGeneratingSummary ? "Gerando..." : "Resumo Semanal"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowProfileModal(true)}>
                  <Settings className="w-4 h-4" />
                  Perfil
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {identityChip}
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-1.5">
            {roomsQuery.data?.map((room: any) => (
              <div key={room.id} className="group flex items-center gap-0.5">
                <button
                  onClick={() => setSelectedRoom(room.id)}
                  className={`flex-1 text-left px-3 py-2.5 rounded-lg transition-colors border border-transparent ${
                    selectedRoom === room.id
                      ? "bg-teal-50 border-slate-200 border-l-4 border-l-teal-500 text-teal-900 font-medium"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <span className="truncate text-sm">{room.name}</span>
                  </div>
                </button>
                <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  {roomMenu(room.id)}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-slate-200 space-y-2">
          <Button
            onClick={handleCreateRoom}
            variant="outline"
            className="w-full border-slate-200 text-slate-700 hover:bg-slate-100"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Sala
          </Button>
        </div>
      </div>



      {/* Main Content */}
      <div style={{ width: `${widths.chat}%` }} className="flex flex-col transition-all duration-75 border-r border-slate-200 overflow-hidden">
        {selectedRoom ? (
          <>
            {/* Header with Participants Button */}
            <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900 truncate">
                  {roomsQuery.data?.find((r: any) => r.id === selectedRoom)?.name}
                </h2>
                <p className="text-[11px] text-slate-500 truncate">Como {currentIdentityLabel}</p>
              </div>
              <button
                onClick={() => setShowParticipantsModal(true)}
                className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
              >
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium text-slate-700">{participants.length} participantes</span>
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {/* Messages with Scrollbar */}
              <div className="flex-1 overflow-hidden" ref={scrollContainerRef}>
                <ScrollArea
                  className="h-full p-6"
                >
                <div className="space-y-5 max-w-4xl mx-auto">
                  <div className="flex flex-col items-center gap-2 py-2">
                    {isLoadingOlder && (
                      <div className="text-xs text-slate-500">Carregando histórico…</div>
                    )}
                    {!isLoadingOlder && hasMoreOlder && messages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => void loadOlderMessages()}
                        className="text-xs text-teal-700 hover:text-teal-800 underline"
                      >
                        Carregar mensagens antigas
                      </button>
                    )}
                    {!hasMoreOlder && messages.length > 0 && (
                      <div className="text-[11px] text-slate-400">Início da conversa</div>
                    )}
                    {isLoadingMessages && messages.length === 0 && (
                      <div className="text-xs text-slate-500">Carregando mensagens…</div>
                    )}
                  </div>
                  {messages.length === 0 && !isLoadingMessages ? (
                    <div className="flex items-center justify-center h-full text-slate-400">
                      <p>Nenhuma mensagem ainda. Comece a conversar!</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className="space-y-2">
                        {msg.replyToId && (
                          <div className="ml-8 pl-4 border-l-2 border-slate-300 text-xs text-slate-500">
                            Respondendo a uma mensagem anterior
                          </div>
                        )}
                        <div
                          className={`flex ${
                            msg.senderId === user?.id
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <div
                            className={`group max-w-md px-3.5 py-2.5 rounded-2xl shadow-none ${
                              msg.senderId === user?.id
                                ? "bg-teal-600 text-white rounded-br-md"
                                : messageMentionsMe(msg.content) || isReplyToMe(msg)
                                  ? "bg-white text-slate-900 border border-teal-300 ring-1 ring-teal-100 rounded-bl-md"
                                  : "bg-white text-slate-900 border border-slate-200 rounded-bl-md"
                            }`}
                          >
                            <p className="text-sm font-medium mb-0.5 tracking-tight">
                              {getMessageSenderLabel(msg)}
                            </p>
                            {msg.replyToId && getRepliedMessage(msg.replyToId) && (
                              <div className="mb-2 p-2 bg-opacity-20 bg-slate-400 rounded border-l-2 border-slate-400 text-xs">
                                <p className="font-semibold text-slate-600">Respondendo a:</p>
                                <p className="text-slate-700 break-words">{getRepliedMessage(msg.replyToId)?.content}</p>
                              </div>
                            )}
                            <p className="text-sm leading-relaxed break-words">{renderMessageContent(msg.content)}</p>
                            {(messageMentionsMe(msg.content) || isReplyToMe(msg)) && msg.senderId !== user?.id && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {messageMentionsMe(msg.content) && (
                                  <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200">
                                    mencionou você
                                  </span>
                                )}
                                {isReplyToMe(msg) && (
                                  <span className="inline-flex items-center rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-800 border border-sky-200">
                                    resposta a você
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="flex items-center justify-between mt-2 gap-2">
                              <p
                                className={`text-xs ${
                                  msg.senderId === user?.id
                                    ? "text-teal-100/90"
                                    : "text-slate-500"
                                }`}
                              >
                                {formatMessageTimestamp(msg.createdAt)}
                              </p>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleThumbsUp(msg.id)}
                                  disabled={toggleThumbsUpMutation.isPending}
                                  className={`p-1 rounded transition-opacity ${
                                    getThumbsSummary(msg.id).reactedByMe
                                      ? msg.senderId === user?.id
                                        ? "text-white"
                                        : "text-teal-600"
                                      : msg.senderId === user?.id
                                        ? "text-teal-100/80 hover:text-white opacity-70 md:opacity-0 md:group-hover:opacity-100"
                                        : "text-slate-400 hover:text-teal-600 opacity-70 md:opacity-0 md:group-hover:opacity-100"
                                  }`}
                                  title={getThumbsSummary(msg.id).reactedByMe ? "Remover joinha" : "Dar joinha"}
                                  aria-label="Joinha"
                                >
                                  <ThumbsUp
                                    className={`w-3.5 h-3.5 ${
                                      getThumbsSummary(msg.id).reactedByMe ? "fill-current" : ""
                                    }`}
                                  />
                                </button>
                                <button
                                  onClick={() => {
                                    setReplyingToId(msg.id);
                                    setReplyingToContent(msg.content);
                                  }}
                                  className={`p-1 rounded transition-opacity opacity-70 md:opacity-0 md:group-hover:opacity-100 ${
                                    msg.senderId === user?.id
                                      ? "text-teal-100/80 hover:text-white"
                                      : "text-slate-400 hover:text-slate-600"
                                  }`}
                                  title="Responder"
                                >
                                  <Reply className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            {(getThumbsSummary(msg.id).count > 0 || getThumbsSummary(msg.id).reactedByMe) && (
                              renderThumbsUpControls(msg)
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {isProcessing && (
                    <div className="flex items-center gap-2 p-4 text-slate-600">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                        <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                        <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                      </div>
                      <span className="text-sm font-medium">IA processando...</span>
                    </div>
                  )}
                </div>
              </ScrollArea>
              </div>

              {/* Unread Messages Indicator */}
              {hasUnreadBelow && (
                <div className="border-t border-slate-200 bg-teal-50/80 px-4 py-1.5 flex items-center justify-center">
                  <button
                    onClick={() => {
                      setIsUserNearBottom(true);
                      scrollToBottom(true);
                    }}
                    className="flex items-center gap-2 text-teal-700 hover:text-teal-900 font-medium text-sm transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Novas mensagens abaixo
                  </button>
                </div>
              )}

              {/* Message Input - Always Visible */}
              <div className="border-t border-slate-200 bg-white p-3 sm:p-4 flex-shrink-0">
                {replyingToId && (
                  <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 mb-1">Respondendo a:</p>
                      <p className="text-sm text-slate-700 truncate">{replyingToContent}</p>
                    </div>
                    <button
                      onClick={() => {
                        setReplyingToId(null);
                        setReplyingToContent("");
                      }}
                      className="ml-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className="relative flex gap-2">
                  {mentionDropdown}
                  <Input
                    ref={messageInputRef}
                    value={messageInput}
                    onChange={(e) => handleComposerChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
                    onClick={(e) => updateMentionFromInput(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
                    onKeyUp={(e) => updateMentionFromInput(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder="Mensagem… use @ para mencionar"
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim()}
                    className="bg-teal-600 hover:bg-teal-700 text-white shadow-none"
                  >
                    Enviar
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-slate-400">Selecione uma sala para começar</p>
          </div>
        )}
      </div>



      {/* Tasks Panel - Desktop Only */}
      <div style={{ width: `${widths.tasks}%` }} className="bg-white flex flex-col max-h-screen transition-all duration-75 overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <img src="/favicon.ico" alt="Tarefas" className="w-8 h-8 rounded-lg" />
            <h2 className="text-base font-semibold text-slate-900">Tarefas</h2>
          </div>
        </div>

        {/* Filtros Desktop */}
        <div className="p-4 border-b border-slate-200 space-y-3 bg-slate-50">
          <Input
            placeholder="Buscar tarefa..."
            value={filterKeyword}
            onChange={(e) => setFilterKeyword(e.target.value)}
            className="text-sm"
          />
          <select
            value={filterAssignedTo || ""}
            onChange={(e) => setFilterAssignedTo(e.target.value || null)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white hover:bg-slate-50"
          >
            <option value="">Todos os responsáveis</option>
            {getUniqueResponsibles().map((r: any) => (
              <option key={r.name} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <Tabs defaultValue="pending" className="flex-1 flex flex-col">
          <TabsList className="w-full rounded-none border-b border-slate-200 bg-slate-50">
            <TabsTrigger value="pending" className="flex-1">
              Pendentes
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex-1">
              Concluídas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full p-4">
              <div className="space-y-3">
                {filteredTasks
                  .filter((t) => t.status !== "completed")
                  .map((task) => (
                    <Card
                      key={task.id}
                      className="group p-3 cursor-pointer hover:bg-slate-50 transition-colors border border-slate-200 shadow-none"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() =>
                            handleToggleTask(task.id, task.status)
                          }
                          className="mt-1 flex-shrink-0"
                        >
                          {getStatusIcon(task.status)}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 break-words">
                            <span className="font-bold text-teal-600">Tarefa {task.taskNumber}:</span> {task.description}
                          </p>
                          {task.assignedToName && (
                            <p className="text-xs text-slate-600 mt-1">
                              👤 {task.assignedToName}
                            </p>
                          )}
                          {renderTaskDates(task)}
                          {(task.priority || task.dueDate) && (
                            <div className="flex gap-2 mt-1.5 flex-wrap">
                              <Badge className={getPriorityColor(task.priority)}>
                                {task.priority}
                              </Badge>
                              {task.dueDate && (
                                <Badge variant="outline" className="text-xs font-normal text-slate-600">
                                  prazo {formatTaskDate(task.dueDate)}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        {taskActionsMenu(task)}
                      </div>
                    </Card>
                  ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="completed" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full p-4">
              <div className="space-y-3">
                {getCompletedTasksNewestFirst(filteredTasks)
                  .map((task) => (
                    <Card
                      key={task.id}
                      className="group p-3 opacity-70 border border-slate-200 shadow-none cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() =>
                            handleToggleTask(task.id, task.status)
                          }
                          className="mt-1 flex-shrink-0"
                        >
                          {getStatusIcon(task.status)}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 break-words line-through">
                            <span className="font-bold text-teal-600">Tarefa {task.taskNumber}:</span> {task.description}
                          </p>
                          {task.assignedToName && (
                            <p className="text-xs text-slate-600 mt-1">
                              👤 {task.assignedToName}
                            </p>
                          )}
                          {renderTaskDates(task, { showCompleted: true })}
                          {task.priority && (
                            <div className="flex gap-2 mt-1.5 flex-wrap">
                              <Badge className={getPriorityColor(task.priority)}>
                                {task.priority}
                              </Badge>
                            </div>
                          )}
                        </div>
                        {taskActionsMenu(task, { withEdit: false })}
                      </div>
                    </Card>
                  ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Participants Modal */}
      {showParticipantsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 w-96 max-w-full mx-4 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">Participantes ({participants.length})</h3>
              <button
                onClick={() => setShowParticipantsModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-sm font-bold text-teal-900">
                    {(p.displayName || p.userName || "U")[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{p.displayName || p.userName}</p>
                    <p className="text-xs text-slate-500">{p.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 w-96 max-w-full mx-4">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Editar Perfil</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nome para exibição no chat
                </label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Digite seu nome"
                  className="w-full"
                />
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                Identidade atual: <span className="font-medium text-slate-900">{user?.displayName || user?.name}</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2 justify-end">
                  <Button
                    onClick={() => setShowProfileModal(false)}
                    variant="outline"
                    className="border-slate-200 text-slate-700 hover:bg-slate-100"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleUpdateProfile}
                    className="bg-teal-600 hover:bg-teal-700 text-white shadow-none"
                  >
                    Salvar
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="border-slate-200 text-slate-700 hover:bg-slate-100"
                  onClick={async () => {
                    await logout();
                    setShowProfileModal(false);
                    toast.message("Selecione novamente quem está usando o app");
                  }}
                >
                  Trocar identidade
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Create Room Dialog */}
      <Dialog open={showCreateRoomDialog} onOpenChange={setShowCreateRoomDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Sala</DialogTitle>
            <DialogDescription>Digite o nome da sala e a senha para criar uma nova sala.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nome da Sala</label>
              <Input
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Digite o nome da sala"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Senha</label>
              <Input
                type="password"
                value={createRoomPassword}
                onChange={(e) => setCreateRoomPassword(e.target.value)}
                placeholder="Digite a senha"
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowCreateRoomDialog(false)}
              variant="outline"
              className="border-slate-200 text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmCreateRoom}
              className="bg-teal-600 hover:bg-teal-700 text-white shadow-none"
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Room Dialog */}
      <Dialog open={showDeleteRoomDialog} onOpenChange={setShowDeleteRoomDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Sala</DialogTitle>
            <DialogDescription>Digite a senha para confirmar a exclusão da sala.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Você tem certeza que deseja excluir esta sala? Esta ação não pode ser desfeita.</p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Senha</label>
              <Input
                type="password"
                value={deleteRoomPassword}
                onChange={(e) => setDeleteRoomPassword(e.target.value)}
                placeholder="Digite a senha"
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowDeleteRoomDialog(false)}
              variant="outline"
              className="border-slate-200 text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmDeleteRoom}
              className="bg-red-600 hover:bg-red-700 text-white shadow-none"
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Weekly Summary Modal */}
      <Dialog open={showSummaryModal} onOpenChange={setShowSummaryModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resumo Semanal</DialogTitle>
            <DialogDescription>
              {summaryStats && (
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-teal-50 p-2 rounded">
                    <p className="text-gray-600">Total de Tarefas</p>
                    <p className="text-lg font-bold text-teal-600">{summaryStats.totalTasks}</p>
                  </div>
                  <div className="bg-green-50 p-2 rounded">
                    <p className="text-gray-600">Concluídas</p>
                    <p className="text-lg font-bold text-green-600">{summaryStats.completedTasks}</p>
                  </div>
                  <div className="bg-yellow-50 p-2 rounded">
                    <p className="text-gray-600">Pendentes</p>
                    <p className="text-lg font-bold text-yellow-600">{summaryStats.pendingTasks}</p>
                  </div>
                  <div className="bg-blue-50 p-2 rounded">
                    <p className="text-gray-600">Taxa de Conclusão</p>
                    <p className="text-lg font-bold text-blue-600">{summaryStats.completionRate.toFixed(1)}%</p>
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 p-4 bg-gray-50 rounded-lg whitespace-pre-wrap text-sm leading-relaxed">
            {weeklySummary}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                // Send summary as message
                if (selectedRoom) {
                  sendMessageMutation.mutate({
                    chatRoomId: selectedRoom,
                    content: `📊 **RESUMO SEMANAL**\n\n${weeklySummary}`,
                  });
                  setShowSummaryModal(false);
                  toast.success("Resumo enviado para o chat!");
                }
              }}
              className="bg-teal-600 hover:bg-teal-700"
            >
              Enviar para o Chat
            </Button>
            <Button variant="outline" onClick={() => setShowSummaryModal(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

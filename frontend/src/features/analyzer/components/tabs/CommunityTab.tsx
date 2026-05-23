"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToast';
import { MessageSquare, Send, AlertCircle, Clock, User, Trash2, Edit2, X, Check, ShieldCheck, ShieldAlert, Users } from 'lucide-react';

interface VoteData {
  safe: number;
  phishing: number;
  userVote: 'safe' | 'phishing' | null;
  tableReady: boolean;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  target_resource: string;
  author_name?: string;
  author_avatar?: string;
}


interface CommunityTabProps {
  targetResource: string;
}

export default function CommunityTab({ targetResource }: CommunityTabProps) {
  const { session } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [badgesMap, setBadgesMap] = useState<Record<string, string>>({});

  // Votación
  const [votes, setVotes] = useState<VoteData>({ safe: 0, phishing: 0, userVote: null, tableReady: true });
  const [votingFor, setVotingFor] = useState<'safe' | 'phishing' | null>(null);

  // Estados de edición
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Cargar votos
  const fetchVotes = useCallback(async () => {
    const headers: Record<string, string> = {};
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    const res = await fetch(`/api/votes?resource=${encodeURIComponent(targetResource)}`, { headers });
    if (res.ok) {
      const data = await res.json();
      setVotes(data);
    }
  }, [targetResource, session]);

  const castVote = async (vote: 'safe' | 'phishing') => {
    if (!session) { useToastStore.getState().showToast('Inicia sesión para votar', 'error'); return; }
    setVotingFor(vote);
    try {
      const res = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ target_resource: targetResource, vote })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Actualizar optimistamente
      setVotes(prev => {
        const newVotes = { ...prev };
        if (prev.userVote === 'safe') newVotes.safe = Math.max(0, newVotes.safe - 1);
        if (prev.userVote === 'phishing') newVotes.phishing = Math.max(0, newVotes.phishing - 1);
        if (vote === 'safe') newVotes.safe++;
        else newVotes.phishing++;
        newVotes.userVote = vote;
        return newVotes;
      });
      useToastStore.getState().showToast('Voto registrado', 'success');
    } catch (e: unknown) {
      useToastStore.getState().showToast(e instanceof Error ? e.message : 'Error al votar', 'error');
    } finally {
      setVotingFor(null);
    }
  };



  const fetchComments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('resource_comments')
      .select('*')
      .eq('target_resource', targetResource)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setComments(data);
      // Fetch badges para los usuarios únicos
      const uniqueUsers = Array.from(new Set(data.map((c: Comment) => c.user_id)));
      if (uniqueUsers.length > 0) {
        fetch(`/api/badges?users=${uniqueUsers.join(',')}`)
          .then(res => res.json())
          .then(bData => {
            if (bData.badges) setBadgesMap(prev => ({ ...prev, ...bData.badges }));
          })
          .catch(console.error);
      }
    }
    setLoading(false);
  }, [targetResource]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchComments();
    fetchVotes();
    
    // Configurar suscripción a nuevos comentarios en tiempo real
    const channel = supabase
      .channel('public:resource_comments')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'resource_comments',
        filter: `target_resource=eq.${targetResource}`
      }, (payload) => {
        const newC = payload.new as Comment;
        setComments(current => [newC, ...current]);
        // Obtener badge del nuevo usuario si no lo tenemos
        if (!badgesMap[newC.user_id]) {
          fetch(`/api/badges?users=${newC.user_id}`)
            .then(res => res.json())
            .then(bData => {
              if (bData.badges) setBadgesMap(prev => ({ ...prev, ...bData.badges }));
            })
            .catch(console.error);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [targetResource, fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !session) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          target_resource: targetResource,
          content: newComment
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al publicar el comentario');
      }

      // Si tiene éxito, limpiamos el formulario y añadimos el comentario a la vista instantáneamente
      if (result.comment) {
        setComments(current => [result.comment, ...current]);
        
        // Obtener badge del usuario que acaba de comentar si no lo tenemos
        if (!badgesMap[result.comment.user_id]) {
          fetch(`/api/badges?users=${result.comment.user_id}`)
            .then(res => res.json())
            .then(bData => {
              if (bData.badges) setBadgesMap(prev => ({ ...prev, ...bData.badges }));
            })
            .catch(console.error);
        }
      }
      setNewComment('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!session) return;
    
    useToastStore.getState().showConfirm(
      '¿Estás seguro de que quieres eliminar este comentario?',
      async () => {
        try {
          const response = await fetch(`/api/comments?id=${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Error al eliminar');
      
          setComments(current => current.filter(c => c.id !== commentId));
          useToastStore.getState().showToast('Comentario eliminado', 'success');
        } catch (err: unknown) {
          useToastStore.getState().showToast(err instanceof Error ? err.message : 'Error', 'error');
        }
      }
    );
  };

  const handleEditStart = (comment: Comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const handleEditSave = async (commentId: string) => {
    if (!session || !editContent.trim()) return;
    
    setEditSubmitting(true);
    try {
      const response = await fetch(`/api/comments`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id: commentId, content: editContent })
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Error al editar');
      
      if (result.comment) {
        setComments(current => current.map(c => c.id === commentId ? result.comment : c));
      }
      setEditingId(null);
      useToastStore.getState().showToast('Comentario actualizado', 'success');
    } catch (err: unknown) {
      useToastStore.getState().showToast(err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setEditSubmitting(false);
    }
  };

  const canEdit = (comment: Comment) => {
    if (!session || session.user.id !== comment.user_id) return false;
    // Solo permitir edición en los primeros 5 minutos
    // eslint-disable-next-line react-hooks/purity
    const ageInMinutes = (Date.now() - new Date(comment.created_at).getTime()) / (1000 * 60);
    return ageInMinutes <= 5;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Panel de Reputación Comunitaria ── */}
      {votes.tableReady && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 sm:p-6 w-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              Reputación Comunitaria
            </h3>
            <span className="text-xs text-zinc-600">{votes.safe + votes.phishing} votos</span>
          </div>

          {/* Barra de consenso */}
          {(votes.safe + votes.phishing) > 0 && (
            <div className="mb-4">
              <div className="flex justify-between text-[11px] text-zinc-500 mb-1.5">
                <span className="text-emerald-400">{votes.safe} seguros</span>
                <span className="text-red-400">{votes.phishing} phishing</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500 rounded-l-full"
                  style={{ width: `${Math.round((votes.safe / (votes.safe + votes.phishing)) * 100)}%` }}
                />
                <div className="h-full bg-red-500 flex-1 rounded-r-full" />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => castVote('safe')}
              disabled={!!votingFor}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed
                ${votes.userVote === 'safe'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-emerald-500/40 hover:text-emerald-400'}`}
            >
              <ShieldCheck size={15} />
              {votes.userVote === 'safe' ? 'Votaste: Segura' : 'Es Segura'}
            </button>
            <button
              onClick={() => castVote('phishing')}
              disabled={!!votingFor}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed
                ${votes.userVote === 'phishing'
                  ? 'bg-red-500/15 border-red-500/40 text-red-400'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-red-500/40 hover:text-red-400'}`}
            >
              <ShieldAlert size={15} />
              {votes.userVote === 'phishing' ? 'Votaste: Phishing' : 'Es Phishing'}
            </button>
          </div>
          {!session && (
            <p className="text-[11px] text-zinc-600 text-center mt-3">Inicia sesión para votar</p>
          )}
        </div>
      )}

      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 sm:p-6 w-full">
        <h3 className="text-lg font-medium text-white mb-2 flex items-center gap-2">
          Comentarios de la Comunidad
        </h3>
        <p className="text-sm text-zinc-400 mb-6">
          Comparte descubrimientos, indicadores de compromiso (IOCs) o advertencias sobre este recurso.

        </p>

        {/* Formulario */}
        {session ? (
          <form onSubmit={handleSubmit} className="mb-8 space-y-3">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Añade un comentario público... (sin enlaces)"
              className="w-full bg-[#050505] border border-zinc-800 rounded-lg p-3 text-sm text-white placeholder-zinc-600 focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 outline-none resize-none h-24 transition-all duration-200 ease-out"
              disabled={submitting}
            />
            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 p-2.5 rounded">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !newComment.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] min-w-[110px]"
              >
                {submitting ? (
                  <div className="flex items-center space-x-2">
                    <span>Publicando</span>
                    <div className="flex space-x-1">
                      <div className="w-1 h-1 bg-white/80 rounded-full animate-dot-jump"></div>
                      <div className="w-1 h-1 bg-white/80 rounded-full animate-dot-jump delay-200"></div>
                      <div className="w-1 h-1 bg-white/80 rounded-full animate-dot-jump delay-400"></div>
                    </div>
                  </div>
                ) : 'Comentar'}
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 text-center mb-8">
            <p className="text-sm text-zinc-400">
              Debes <button className="text-indigo-400 hover:text-indigo-300 font-medium border-b border-indigo-400/30">iniciar sesión</button> para poder comentar.
            </p>
          </div>
        )}

        {/* Lista de Comentarios */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-zinc-500 text-sm">Cargando comentarios...</div>
          ) : comments.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-zinc-800 rounded-lg">
              <MessageSquare size={24} className="text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm">Aún no hay comentarios para este recurso.</p>
              <p className="text-zinc-500 text-xs mt-1">Sé el primero en compartir tu análisis.</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-4 p-4 rounded-lg bg-[#050505] border border-zinc-800 group transition-all hover:bg-[#0a0a0a]">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#444]">
                  {comment.author_avatar ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={comment.author_avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User size={18} className="text-zinc-400" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-300">
                        {comment.author_name || 'Usuario anónimo'}
                      </span>
                      {badgesMap[comment.user_id] && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-zinc-800 text-zinc-400 font-mono uppercase tracking-wider">
                          {badgesMap[comment.user_id]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {canEdit(comment) && editingId !== comment.id && (
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEditStart(comment)} className="text-zinc-500 hover:text-indigo-400 transition-colors p-1" title="Editar comentario">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDelete(comment.id)} className="text-zinc-500 hover:text-red-400 transition-colors p-1" title="Eliminar comentario">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                      <span className="text-xs text-zinc-600 flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(comment.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  
                  {editingId === comment.id ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full bg-[#111] border border-zinc-700 rounded p-2 text-sm text-white focus:border-indigo-500 focus:ring-0 outline-none resize-none h-20"
                        disabled={editSubmitting}
                      />
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => setEditingId(null)}
                          disabled={editSubmitting}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                        >
                          <X size={14} /> Cancelar
                        </button>
                        <button 
                          onClick={() => handleEditSave(comment.id)}
                          disabled={editSubmitting || !editContent.trim()}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                          {editSubmitting ? 'Guardando...' : <><Check size={14} /> Guardar</>}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-400 whitespace-pre-wrap leading-relaxed">{comment.content}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

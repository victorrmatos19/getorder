'use client'

import { useState } from 'react'
import StaffHeader from '@/components/StaffHeader'
import EmptyState from '@/components/EmptyState'
import Spinner from '@/components/Spinner'
import Toast from '@/components/Toast'
import { useUsuarios, gerarSenhaForte } from '@/lib/hooks/useUsuarios'
import { useRestaurante } from '@/lib/contexts/RestauranteContext'
import type { Role, UsuarioEquipe } from '@/types'

const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'Super admin',
  admin: 'Admin',
  garcom: 'Garçom',
  cozinha: 'Cozinha',
}

const GERENCIAVEL = (r: Role) => r === 'garcom' || r === 'cozinha'

export default function UsuariosAdminPage() {
  const { email: myEmail } = useRestaurante()
  const { list, criar, patch } = useUsuarios()
  const { data: usuarios = [], isLoading, isError, refetch } = list

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<UsuarioEquipe | null>(null)
  const [senhaDe, setSenhaDe] = useState<UsuarioEquipe | null>(null)
  const [confirmDesativar, setConfirmDesativar] = useState<string | null>(null)
  const [toast, setToast] = useState({ visible: false, message: '' })

  const showToast = (message: string) => setToast({ visible: true, message })

  const handleCriar = (d: { nome: string; email: string; password: string; role: Role }) => {
    criar.mutate(d, {
      onSuccess: () => { setCreating(false); showToast('Usuário criado') },
      onError: (e: any) => showToast(e.message || 'Erro ao criar'),
    })
  }

  // Editar dispara as ações necessárias em sequência (nome e/ou role mudaram).
  const handleEditar = async (d: { nome: string; role: Role }) => {
    if (!editing) return
    try {
      if (d.nome !== (editing.nome ?? '')) {
        await patch.mutateAsync({ id: editing.id, action: 'update_nome', nome: d.nome })
      }
      if (d.role !== editing.role) {
        await patch.mutateAsync({ id: editing.id, action: 'change_role', role: d.role })
      }
      setEditing(null)
      showToast('Usuário atualizado')
    } catch (e: any) {
      showToast(e.message || 'Erro ao salvar')
    }
  }

  const handleSenha = (password: string) => {
    if (!senhaDe) return
    patch.mutate(
      { id: senhaDe.id, action: 'reset_password', password },
      {
        onSuccess: () => { setSenhaDe(null); showToast('Senha redefinida') },
        onError: (e: any) => showToast(e.message || 'Erro ao redefinir senha'),
      },
    )
  }

  const toggleAtivo = (u: UsuarioEquipe) => {
    patch.mutate(
      { id: u.id, action: u.ativo ? 'deactivate' : 'reactivate' },
      {
        onSuccess: () => {
          setConfirmDesativar(null)
          showToast(u.ativo ? 'Usuário desativado' : 'Usuário reativado')
        },
        onError: (e: any) => showToast(e.message || 'Erro ao atualizar'),
      },
    )
  }

  return (
    <>
      <StaffHeader
        title="Equipe"
        subtitle="Admin"
        rightSlot={
          <button
            onClick={() => setCreating(true)}
            className="text-xs px-3 py-2 rounded-xl font-bold"
            style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none' }}
          >
            + Novo
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading && <div className="py-16 flex justify-center"><Spinner color="var(--accent)" /></div>}
        {isError && (
          <EmptyState
            icon="⚠️"
            title="Erro ao carregar"
            action={
              <button onClick={() => refetch()} className="text-sm underline" style={{ color: 'var(--accent)' }}>
                Tentar novamente
              </button>
            }
          />
        )}
        {!isLoading && !isError && usuarios.length === 0 && (
          <EmptyState
            icon="👥"
            title="Nenhum usuário na equipe"
            description="Crie o primeiro garçom ou cozinha."
          />
        )}

        <ul className="flex flex-col gap-2">
          {usuarios.map((u) => {
            const editavel = GERENCIAVEL(u.role)
            const ehVoce = !!myEmail && u.email === myEmail
            const confirmando = confirmDesativar === u.id
            return (
              <li
                key={u.id}
                className="rounded-xl px-4 py-3"
                style={{ background: 'var(--surface)', border: '1px solid var(--line)', opacity: u.ativo ? 1 : 0.6 }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate" style={{ color: 'var(--ink)' }}>
                      {u.nome || u.email || '—'}
                    </div>
                    {u.email && (
                      <div className="text-xs truncate" style={{ color: 'var(--text-mid)' }}>{u.email}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ border: '1px solid var(--line)', color: 'var(--text-mid)' }}
                    >
                      {ehVoce ? 'Você' : ROLE_LABEL[u.role]}
                    </span>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{
                        border: `1px solid ${u.ativo ? 'var(--status-ready)' : 'var(--muted)'}`,
                        color: u.ativo ? 'var(--status-ready)' : 'var(--muted)',
                      }}
                    >
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>

                {editavel && !confirmando && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setEditing(u)}
                      className="text-xs px-3 py-2 rounded-xl"
                      style={{ border: '1px solid var(--line)', color: 'var(--text-mid)' }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setSenhaDe(u)}
                      className="text-xs px-3 py-2 rounded-xl"
                      style={{ border: '1px solid var(--line)', color: 'var(--text-mid)' }}
                    >
                      Senha
                    </button>
                    <button
                      onClick={() => (u.ativo ? setConfirmDesativar(u.id) : toggleAtivo(u))}
                      className="text-xs px-3 py-2 rounded-xl ml-auto"
                      style={{
                        border: `1px solid ${u.ativo ? 'var(--accent)' : 'var(--status-ready)'}`,
                        color: u.ativo ? 'var(--accent)' : 'var(--status-ready)',
                      }}
                    >
                      {u.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                  </div>
                )}

                {editavel && confirmando && (
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-xs flex-1" style={{ color: 'var(--text-mid)' }}>
                      Desativar este usuário? Ele não poderá mais entrar.
                    </span>
                    <button
                      onClick={() => toggleAtivo(u)}
                      disabled={patch.isPending}
                      className="text-xs px-3 py-2 rounded-xl font-bold"
                      style={{ background: 'var(--accent)', color: 'var(--on-accent)', border: 'none' }}
                    >
                      Desativar
                    </button>
                    <button
                      onClick={() => setConfirmDesativar(null)}
                      className="text-xs px-3 py-2 rounded-xl"
                      style={{ border: '1px solid var(--line)', color: 'var(--text-mid)' }}
                    >
                      Voltar
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {creating && (
        <UsuarioForm
          initial={null}
          busy={criar.isPending}
          onClose={() => setCreating(false)}
          onSubmitCriar={handleCriar}
          onSubmitEditar={handleEditar}
        />
      )}
      {editing && (
        <UsuarioForm
          initial={editing}
          busy={patch.isPending}
          onClose={() => setEditing(null)}
          onSubmitCriar={handleCriar}
          onSubmitEditar={handleEditar}
        />
      )}
      {senhaDe && (
        <SenhaModal
          usuario={senhaDe}
          busy={patch.isPending}
          onClose={() => setSenhaDe(null)}
          onSubmit={handleSenha}
        />
      )}

      <Toast
        visible={toast.visible}
        message={toast.message}
        onClose={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </>
  )
}

// ── Form de criar/editar ────────────────────────────────────────────
function UsuarioForm({
  initial, busy, onClose, onSubmitCriar, onSubmitEditar,
}: {
  initial: UsuarioEquipe | null
  busy: boolean
  onClose: () => void
  onSubmitCriar: (d: { nome: string; email: string; password: string; role: Role }) => void
  onSubmitEditar: (d: { nome: string; role: Role }) => void
}) {
  const editando = !!initial
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>((initial?.role as Role) ?? 'garcom')

  const podeSalvar = editando
    ? nome.trim().length > 0
    : nome.trim().length > 0 && email.trim().length > 0 && password.length >= 8

  const submit = () => {
    if (editando) onSubmitEditar({ nome: nome.trim(), role })
    else onSubmitCriar({ nome: nome.trim(), email: email.trim(), password, role })
  }

  return (
    <Sheet title={editando ? 'Editar usuário' : 'Novo usuário'} onClose={() => !busy && onClose()}>
      <Campo label="Nome">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Ana Paula"
          className="w-full py-3 text-base"
          style={inputStyle}
        />
      </Campo>

      <Campo label="E-mail">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={editando}
          placeholder="garcom@restaurante.com"
          className="w-full py-3 text-base"
          style={{ ...inputStyle, opacity: editando ? 0.6 : 1 }}
        />
      </Campo>

      <Campo label="Função">
        <div className="flex gap-2 mt-1">
          {(['garcom', 'cozinha'] as Role[]).map((r) => {
            const active = role === r
            return (
              <button
                key={r}
                onClick={() => setRole(r)}
                className="flex-1 rounded-xl text-sm py-2"
                style={{
                  background: active ? 'var(--ink)' : 'transparent',
                  color: active ? 'var(--bg)' : 'var(--text-mid)',
                  border: `1px solid ${active ? 'var(--ink)' : 'var(--line)'}`,
                  fontWeight: active ? 700 : 400,
                }}
              >
                {ROLE_LABEL[r]}
              </button>
            )
          })}
        </div>
      </Campo>

      {!editando && (
        <Campo label="Senha inicial (mín. 8)">
          <SenhaInput value={password} onChange={setPassword} />
        </Campo>
      )}

      <Acoes
        busy={busy}
        podeSalvar={podeSalvar}
        onClose={onClose}
        onSubmit={submit}
      />
    </Sheet>
  )
}

// ── Modal de resetar senha ──────────────────────────────────────────
function SenhaModal({
  usuario, busy, onClose, onSubmit,
}: {
  usuario: UsuarioEquipe
  busy: boolean
  onClose: () => void
  onSubmit: (password: string) => void
}) {
  const [password, setPassword] = useState('')
  return (
    <Sheet title="Redefinir senha" onClose={() => !busy && onClose()}>
      <div className="text-sm mb-4" style={{ color: 'var(--text-mid)' }}>
        Nova senha para <span style={{ color: 'var(--ink)' }}>{usuario.nome || usuario.email}</span>.
      </div>
      <Campo label="Nova senha (mín. 8)">
        <SenhaInput value={password} onChange={setPassword} />
      </Campo>
      <Acoes
        busy={busy}
        podeSalvar={password.length >= 8}
        onClose={onClose}
        onSubmit={() => onSubmit(password)}
        label="Redefinir"
      />
    </Sheet>
  )
}

// ── Peças compartilhadas ────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  border: 'none',
  borderBottom: '1px solid var(--line)',
  background: 'transparent',
  color: 'var(--ink)',
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full px-6 pt-6 pb-8 animate-slide-up safe-bottom max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0' }}
      >
        <div className="serif text-xl mb-5" style={{ color: 'var(--ink)' }}>{title}</div>
        {children}
      </div>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-xs mb-1" style={{ color: 'var(--text-mid)' }}>{label}</label>
      {children}
    </div>
  )
}

function SenhaInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••"
        autoComplete="off"
        className="flex-1 py-3 text-base mono-num"
        style={inputStyle}
      />
      <button
        type="button"
        onClick={() => onChange(gerarSenhaForte())}
        className="text-xs px-3 py-2 rounded-xl shrink-0"
        style={{ border: '1px solid var(--line)', color: 'var(--accent)' }}
      >
        Gerar
      </button>
    </div>
  )
}

function Acoes({
  busy, podeSalvar, onClose, onSubmit, label = 'Salvar',
}: {
  busy: boolean
  podeSalvar: boolean
  onClose: () => void
  onSubmit: () => void
  label?: string
}) {
  return (
    <div className="flex gap-2 mt-6">
      <button
        onClick={onClose}
        disabled={busy}
        className="flex-1 rounded-xl text-sm"
        style={{ minHeight: 48, border: '1px solid var(--line)', color: 'var(--text-mid)' }}
      >
        Cancelar
      </button>
      <button
        onClick={onSubmit}
        disabled={busy || !podeSalvar}
        className="rounded-xl text-sm font-bold flex items-center justify-center gap-2"
        style={{
          flex: 2,
          minHeight: 48,
          background: podeSalvar && !busy ? 'var(--accent)' : 'var(--line)',
          color: podeSalvar && !busy ? 'var(--on-accent)' : 'var(--muted)',
          border: 'none',
        }}
      >
        {busy ? <><Spinner /> Salvando</> : label}
      </button>
    </div>
  )
}

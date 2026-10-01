"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  acceptGroupInvite,
  createGroup,
  deleteGroup,
  inviteToGroup,
  loadGroups,
  removeGroupMember,
  updateGroup,
  type Group,
} from "@/app/social/groups";
import type { Person } from "@/app/social/actions";
import { Spinner } from "@/components/spinner";
import { avatarInitial } from "@/lib/profile/avatar";
import { toSquareJpeg } from "@/lib/profile/square-photo";
import { GROUP_DESCRIPTION_MAX, GROUP_NAME_MAX, GROUP_PHOTO_BUCKET } from "@/lib/social/groups";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userId: string;
  groups: Group[];
  onGroups: (next: Group[]) => void;
  // My friends: the only people I can invite.
  friends: Person[];
  onFindFriends: () => void;
};

export const primary = "h-10 rounded-full bg-accent px-4 text-sm font-semibold text-white shadow disabled:opacity-50";
export const secondary = "h-10 rounded-full bg-neutral-100 px-4 text-sm font-semibold text-neutral-700 disabled:opacity-50";

// Grupos: invites to answer, my groups, and "Criar grupo". A group opens its page (/social/grupos/{id}).
export function GroupsTab({ userId, groups, onGroups, friends, onFindFriends }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const invites = groups.filter((group) => group.myStatus === "invited");
  const mine = groups.filter((group) => group.myStatus === "member");

  async function refresh() {
    onGroups(await loadGroups());
  }

  async function answer(group: Group, accept: boolean) {
    setBusy(group.id);
    setError(null);
    const { ok } = accept ? await acceptGroupInvite(group.id) : await removeGroupMember(group.id, userId);
    setBusy(null);
    if (!ok) {
      setError("Não foi possível. Tenta outra vez.");
      return;
    }
    if (accept) router.push(groupHref(group.id));
    else await refresh();
  }

  return (
    <>
      {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {invites.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 px-1 text-sm font-semibold text-neutral-500">Convites</h2>
          <ul className="flex flex-col gap-3">
            {invites.map((group) => (
              <li key={group.id} className="rounded-2xl bg-white p-4 shadow-sm ring-2 ring-accent/40 motion-safe:animate-[fork-pop_260ms_ease-out_both]">
                <div className="flex items-start gap-3">
                  <GroupPhoto group={group} className="size-14 text-2xl" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold">{group.name}</p>
                    <p className="text-sm text-neutral-500">
                      {group.invitedBy ? `${group.invitedBy.displayName} convidou-te` : "Foste convidado"} ·{" "}
                      {memberCount(group)}
                    </p>
                    {group.description && <p className="mt-1 line-clamp-2 text-sm text-neutral-700">{group.description}</p>}
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" disabled={busy === group.id} onClick={() => answer(group, false)} className={secondary}>
                    Recusar
                  </button>
                  <button type="button" disabled={busy === group.id} onClick={() => answer(group, true)} className={primary}>
                    Entrar no grupo
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-neutral-500">Os meus grupos</h2>
        {mine.length > 0 && (
          <button type="button" onClick={() => setCreating(true)} className="text-sm font-semibold text-accent">
            + Criar grupo
          </button>
        )}
      </div>

      {mine.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 px-6 text-center">
          <span aria-hidden="true" className="text-5xl">
            👥
          </span>
          <h2 className="text-lg font-semibold">Ainda não tens grupos</h2>
          <p className="text-sm text-neutral-500">Cria um grupo e convida os teus amigos para os jantares de sempre.</p>
          <button type="button" onClick={() => setCreating(true)} className={`${primary} mt-2`}>
            Criar grupo
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {mine.map((group, index) => (
            <li key={group.id} style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }} className="motion-safe:animate-[fork-pop_260ms_ease-out_both]">
              <Link
                href={groupHref(group.id)}
                className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-black/5 transition active:scale-[0.98]"
              >
                <GroupPhoto group={group} className="size-14 text-2xl" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-semibold">{group.name}</span>
                  {group.description && <span className="block truncate text-sm text-neutral-600">{group.description}</span>}
                  <span className="mt-1 flex items-center gap-2">
                    <Faces people={group.members.filter((member) => member.status === "member")} />
                    <span className="text-xs text-neutral-500">{memberCount(group)}</span>
                  </span>
                </span>
                <span aria-hidden="true" className="text-xl text-neutral-300">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <GroupForm
          userId={userId}
          friends={friends}
          onFindFriends={onFindFriends}
          onClose={() => setCreating(false)}
          onSaved={async (id) => {
            setCreating(false);
            if (id) router.push(groupHref(id));
            else await refresh();
          }}
        />
      )}
    </>
  );
}

export function groupHref(id: string): string {
  return `/social/grupos/${id}`;
}

export function memberCount(group: Group): string {
  const count = group.members.filter((member) => member.status === "member").length;
  return count === 1 ? "1 membro" : `${count} membros`;
}

export function GroupPhoto({ group, url, className }: { group?: Pick<Group, "photoUrl" | "name">; url?: string | null; className: string }) {
  const src = url !== undefined ? url : group?.photoUrl;
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-orange-200 to-violet-200 ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL / local preview
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span aria-hidden="true">👥</span>
      )}
    </span>
  );
}

export function PersonAvatar({ person, className = "size-11 text-base" }: { person: Person; className?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent font-semibold text-white ${className}`}>
      {person.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL
        <img src={person.avatarUrl} alt="" className="size-full object-cover" />
      ) : (
        avatarInitial(person.username)
      )}
    </span>
  );
}

// Up to 4 overlapping member faces.
function Faces({ people }: { people: Person[] }) {
  return (
    <span className="flex -space-x-2">
      {people.slice(0, 4).map((person) => (
        <PersonAvatar key={person.id} person={person} className="size-6 text-[10px] ring-2 ring-white" />
      ))}
    </span>
  );
}

export function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  // Esc closes.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // Rendered at the top of the page: an animated card around it would otherwise trap it under the next cards.
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 motion-safe:animate-[fade-in_150ms_ease-out]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-xl motion-safe:animate-[sheet-up_250ms_ease-out_both]"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="min-w-0 flex-1 truncate text-xl font-semibold">{title}</h2>
      <button type="button" aria-label="Fechar" onClick={onClose} className="-m-1 p-1 leading-none text-neutral-500">
        ✕
      </button>
    </div>
  );
}

type FormProps = {
  userId: string;
  // Editing an existing group (owner); creating when missing.
  group?: Group;
  friends: Person[];
  onFindFriends?: () => void;
  onClose: () => void;
  onSaved: (id: string | null) => void;
};

// Criar grupo / Editar grupo: photo, name, description and (when creating) friends to invite.
function GroupForm({ userId, group, friends, onFindFriends, onClose, onSaved }: FormProps) {
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  // A new photo chosen in this form (uploaded on save), or removed.
  const [photo, setPhoto] = useState<{ file: File; preview: string } | "removed" | null>(null);
  const [invite, setInvite] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = photo === "removed" ? null : photo ? photo.preview : (group?.photoUrl ?? null);

  useEffect(() => () => {
    if (photo && photo !== "removed") URL.revokeObjectURL(photo.preview);
  }, [photo]);

  async function save() {
    setSaving(true);
    setError(null);
    const storage = createClient().storage.from(GROUP_PHOTO_BUCKET);
    let uploaded: string | null = null;
    try {
      // Left out (undefined) keeps the current photo.
      let photoPath: string | null | undefined = photo === "removed" ? null : undefined;
      if (photo && photo !== "removed") {
        const blob = await toSquareJpeg(photo.file);
        uploaded = `${userId}/${Date.now()}.jpg`;
        const { error: uploadError } = await storage.upload(uploaded, blob, { contentType: "image/jpeg" });
        if (uploadError) throw new Error("Não foi possível usar esta foto. Experimenta outra.");
        photoPath = uploaded;
      }
      const fields = { name, description: description.trim() || null };
      const result: { ok: boolean; error?: string; id?: string } = group
        ? await updateGroup(group.id, { ...fields, photoPath })
        : await createGroup({ ...fields, photoPath: photoPath ?? null, invite: [...invite] });
      if (!result.ok) throw new Error(result.error ?? "Não foi possível guardar. Tenta outra vez.");
      onSaved(group ? group.id : (result.id ?? null));
    } catch (caught) {
      if (uploaded) await storage.remove([uploaded]);
      setError(caught instanceof Error ? caught.message : "Não foi possível guardar. Tenta outra vez.");
      setSaving(false);
    }
  }

  return (
    <Sheet label={group ? "Editar grupo" : "Criar grupo"} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && !saving) void save();
        }}
      >
        <SheetHeader title={group ? "Editar grupo" : "Criar grupo"} onClose={onClose} />

        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-label={preview ? "Mudar a foto do grupo" : "Adicionar foto do grupo"}
            className="group relative transition active:scale-95"
          >
            <GroupPhoto url={preview} className="size-28 text-5xl shadow-md ring-4 ring-white" />
            <span
              aria-hidden="true"
              className="absolute -right-2 -bottom-2 flex size-10 items-center justify-center rounded-full bg-white text-lg shadow-md ring-2 ring-orange-100 transition group-hover:scale-110"
            >
              📷
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) setPhoto({ file, preview: URL.createObjectURL(file) });
            }}
          />
          {preview && (
            <button type="button" onClick={() => setPhoto("removed")} className="mt-1 text-xs text-neutral-400 underline">
              Remover foto
            </button>
          )}
        </div>

        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-sm font-medium">
            Nome <span className="font-normal text-neutral-400">{name.length}/{GROUP_NAME_MAX}</span>
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={GROUP_NAME_MAX}
            placeholder="Ex.: Jantares de sexta"
            autoFocus={!group}
            className="h-12 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-base outline-none focus:border-accent focus:bg-white"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-sm font-medium">
            Descrição{" "}
            <span className="font-normal text-neutral-400">
              {description.length}/{GROUP_DESCRIPTION_MAX}
            </span>
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={GROUP_DESCRIPTION_MAX}
            rows={3}
            placeholder="Para que é este grupo? (opcional)"
            className="resize-none rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-base outline-none focus:border-accent focus:bg-white"
          />
        </label>

        {!group && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Convidar amigos</span>
            {friends.length === 0 ? (
              <p className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                Ainda não tens amigos para convidar.{" "}
                {onFindFriends && (
                  <button type="button" onClick={onFindFriends} className="font-semibold text-accent">
                    Procurar amigos
                  </button>
                )}
              </p>
            ) : (
              <FriendPicker people={friends} selected={invite} onChange={setInvite} />
            )}
          </div>
        )}

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button type="submit" disabled={!name.trim() || saving} className={`${primary} flex h-12 items-center justify-center gap-2 text-base`}>
          {saving && <Spinner className="size-5 border-white/30 border-t-white" />}
          {group ? "Guardar" : invite.size > 0 ? `Criar e convidar ${invite.size}` : "Criar grupo"}
        </button>
      </form>
    </Sheet>
  );
}

function FriendPicker({ people, selected, onChange }: { people: Person[]; selected: Set<string>; onChange: (next: Set<string>) => void }) {
  return (
    <ul className="max-h-60 overflow-y-auto rounded-2xl ring-1 ring-neutral-200">
      {people.map((person) => {
        const checked = selected.has(person.id);
        return (
          <li key={person.id} className="border-b border-neutral-100 last:border-0">
            <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5">
              <PersonAvatar person={person} className="size-9 text-sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{person.displayName}</span>
                <span className="block truncate text-xs text-neutral-500">@{person.username}</span>
              </span>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  const next = new Set(selected);
                  if (checked) next.delete(person.id);
                  else next.add(person.id);
                  onChange(next);
                }}
                className="size-5 accent-[var(--color-accent)]"
              />
            </label>
          </li>
        );
      })}
    </ul>
  );
}

type SheetProps = {
  group: Group;
  userId: string;
  friends: Person[];
  onClose: () => void;
  onChanged: () => Promise<void>;
};

// One group: photo, name, description and members. Members invite friends and leave; the owner edits, removes
// members and deletes the group.
export function GroupSheet({ group, userId, friends, onClose, onChanged }: SheetProps) {
  const [mode, setMode] = useState<"view" | "edit" | "invite">("view");
  const [invite, setInvite] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inGroup = new Set(group.members.map((member) => member.id));
  const invitable = friends.filter((friend) => !inGroup.has(friend.id));

  async function run(action: () => Promise<{ ok: boolean }>, after?: () => void) {
    setBusy(true);
    setError(null);
    const { ok } = await action();
    if (ok) {
      after?.();
      await onChanged();
    } else setError("Não foi possível. Tenta outra vez.");
    setBusy(false);
  }

  if (mode === "edit") {
    return (
      <GroupForm
        userId={userId}
        group={group}
        friends={friends}
        onClose={() => setMode("view")}
        onSaved={async () => {
          await onChanged();
          setMode("view");
        }}
      />
    );
  }

  return (
    <Sheet label={group.name} onClose={onClose}>
      <SheetHeader title={mode === "invite" ? "Convidar amigos" : ""} onClose={onClose} />

      {mode === "invite" ? (
        <>
          {invitable.length === 0 ? (
            <p className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-500">Todos os teus amigos já estão no grupo ou foram convidados.</p>
          ) : (
            <FriendPicker people={invitable} selected={invite} onChange={setInvite} />
          )}
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode("view")} className={`${secondary} flex-1`}>
              Voltar
            </button>
            <button
              type="button"
              disabled={busy || invite.size === 0}
              onClick={() =>
                run(
                  () => inviteToGroup(group.id, [...invite]),
                  () => {
                    setInvite(new Set());
                    setMode("view");
                  },
                )
              }
              className={`${primary} flex-1`}
            >
              {invite.size > 1 ? `Convidar ${invite.size}` : "Convidar"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="-mt-4 flex flex-col items-center text-center">
            <GroupPhoto group={group} className="size-28 text-5xl shadow-md ring-4 ring-white" />
            <h2 className="mt-3 text-2xl font-bold">{group.name}</h2>
            <p className="text-sm text-neutral-500">{memberCount(group)}</p>
            {group.description && <p className="mt-2 text-[15px] whitespace-pre-line text-neutral-700">{group.description}</p>}
          </div>

          {group.myStatus === "member" && (
            <div className="flex gap-2">
              <button type="button" onClick={() => setMode("invite")} className={`${primary} flex-1`}>
                + Convidar amigos
              </button>
              {group.isOwner && (
                <button type="button" onClick={() => setMode("edit")} className={`${secondary} flex-1`}>
                  ✏️ Editar
                </button>
              )}
            </div>
          )}

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <section>
            <h3 className="mb-2 px-1 text-sm font-semibold text-neutral-500">Membros</h3>
            <ul className="overflow-hidden rounded-2xl ring-1 ring-neutral-200">
              {group.members.map((member) => (
                <li key={member.id} className="flex items-center gap-3 border-b border-neutral-100 px-4 py-2.5 last:border-0">
                  <PersonAvatar person={member} className={`size-10 text-sm ${member.status === "invited" ? "opacity-50" : ""}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {member.displayName}
                      {member.id === userId && <span className="font-normal text-neutral-400"> (tu)</span>}
                    </span>
                    <span className="block truncate text-xs text-neutral-500">@{member.username}</span>
                  </span>
                  {member.id === group.ownerId ? (
                    <Tag>Criador</Tag>
                  ) : member.status === "invited" ? (
                    <Tag muted>Convidado</Tag>
                  ) : null}
                  {group.isOwner && member.id !== userId && (
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={member.status === "invited" ? `Cancelar o convite a ${member.displayName}` : `Remover ${member.displayName}`}
                      onClick={() => {
                        const question =
                          member.status === "invited"
                            ? `Cancelar o convite a ${member.displayName}?`
                            : `Remover ${member.displayName} do grupo?`;
                        if (window.confirm(question)) void run(() => removeGroupMember(group.id, member.id));
                      }}
                      className="-mr-1 flex size-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100"
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {group.myStatus === "member" &&
            (group.isOwner ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Apagar o grupo “${group.name}”? Todos os membros saem.`))
                    void run(() => deleteGroup(group.id), onClose);
                }}
                className="h-11 rounded-full text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Apagar grupo
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Sair do grupo “${group.name}”?`)) void run(() => removeGroupMember(group.id, userId), onClose);
                }}
                className="h-11 rounded-full text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Sair do grupo
              </button>
            ))}
        </>
      )}
    </Sheet>
  );
}

function Tag({ muted, children }: { muted?: boolean; children: React.ReactNode }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${muted ? "bg-neutral-100 text-neutral-500" : "bg-orange-100 text-accent"}`}>
      {children}
    </span>
  );
}

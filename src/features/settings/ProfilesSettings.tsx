import { useState } from 'react';
import { useStore } from '@/lib/db/store';
import type { Profile } from '@/lib/db/types';
import { saveProfile } from '@/lib/actions';
import { removeFiles, uploadAvatar } from '@/lib/images';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Form';
import { AvatarPicker } from '@/components/AvatarEditor';
import { useAuth } from '@/features/auth/AuthProvider';

function ProfileCard({ p }: { p: Profile }) {
  const { user } = useAuth();
  const s = useStore();
  const [name, setName] = useState(p.name);
  const [saved, setSaved] = useState(false);
  const isMe = !!user && p.user_id === user.id;
  const meElsewhere = !!user && s.profiles.some((x) => x.id !== p.id && x.user_id === user.id);
  return (
    <section className="card space-y-4 p-4">
      <AvatarPicker
        path={p.avatar_path}
        name={p.name}
        color={p.slot === 1 ? 'var(--gold)' : 'var(--accent)'}
        onUpload={async (blob) => {
          const old = p.avatar_path;
          const path = await uploadAvatar('profiles', p.id, blob);
          await saveProfile(p.id, { avatar_path: path });
          void removeFiles([old]);
        }}
        onRemove={async () => {
          const old = p.avatar_path;
          await saveProfile(p.id, { avatar_path: null });
          void removeFiles([old]);
        }}
      />
      <Field label="Naam">
        {(id) => (
          <div className="flex gap-2">
            <input id={id} className="field" value={name} onChange={(e) => (setName(e.target.value), setSaved(false))} maxLength={60} />
            <Button
              variant="primary"
              disabled={!name.trim() || name.trim() === p.name}
              onClick={() => void saveProfile(p.id, { name: name.trim() }).then(() => setSaved(true))}
            >
              Opslaan
            </Button>
          </div>
        )}
      </Field>
      {saved && <p className="text-xs text-accent">Opgeslagen.</p>}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm">
        <span className="text-muted">{isMe ? 'Dit profiel is gekoppeld aan jouw login.' : p.user_id ? 'Gekoppeld aan de login van de ander.' : 'Nog niet gekoppeld aan een login.'}</span>
        {!isMe && !p.user_id && !meElsewhere && (
          <Button size="sm" onClick={() => void saveProfile(p.id, { user_id: user!.id })}>
            Dit ben ik
          </Button>
        )}
        {isMe && (
          <Button size="sm" variant="ghost" onClick={() => void saveProfile(p.id, { user_id: null })}>
            Ontkoppelen
          </Button>
        )}
      </div>
    </section>
  );
}

export default function ProfilesSettings() {
  const s = useStore();
  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 md:px-0">
      <PageHeader back="/instellingen" title="Profielen" subtitle="Het middelpunt van jullie netwerk" />
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        {s.profiles.map((p) => (
          <ProfileCard key={p.id} p={p} />
        ))}
      </div>
    </div>
  );
}

import { getSession } from '@/lib/auth';
import { getPortalByMxid } from '@/lib/mautrix-db';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { GroupConfigForm } from '@/components/group-config-form';
import { UsersList } from '@/components/users-list';

interface Props {
  params: Promise<{ groupId: string }>;
}

export default async function GroupPage({ params }: Props) {
  const { groupId } = await params;
  const session = await getSession();
  if (!session) redirect('/');

  const mxid = decodeURIComponent(groupId);

  // Busca info do portal no mautrix
  const portal = await getPortalByMxid(mxid);

  if (!portal) {
    notFound();
  }

  // Verifica se o usuario é o relay deste grupo
  if (portal.relay_login_id !== session.phoneNumber) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <h1 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Acesso negado</h1>
        <p style={{ color: 'var(--muted-foreground)' }}>
          Voce nao é o relay deste grupo.
        </p>
        <Link href="/dashboard" style={{ color: 'var(--primary)', marginTop: '1rem', display: 'inline-block' }}>
          Voltar ao dashboard
        </Link>
      </div>
    );
  }

  // Busca ou cria config do grupo
  let groupConfig = await prisma.groupConfig.findUnique({
    where: { matrixRoomId: mxid },
    include: { users: true },
  });

  const admin = await prisma.admin.findUnique({
    where: { id: session.adminId },
  });

  if (!admin) redirect('/');

  // Se nao existe config, cria uma
  if (!groupConfig) {
    groupConfig = await prisma.groupConfig.create({
      data: {
        matrixRoomId: mxid,
        adminId: admin.id,
      },
      include: { users: true },
    });
  }

  const cardStyle: React.CSSProperties = {
    padding: '1.25rem',
    border: '1px solid var(--border)',
    borderRadius: '0.5rem',
    marginBottom: '1.5rem',
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          href="/dashboard"
          style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}
        >
          ← Voltar
        </Link>
      </div>

      <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        {portal.name || 'Grupo sem nome'}
      </h1>
      <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: '2rem', fontFamily: 'monospace' }}>
        {mxid}
      </p>

      {/* Configuracao do grupo */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
          Configuracoes
        </h2>
        <div style={cardStyle}>
          <GroupConfigForm
            groupId={groupConfig.id}
            hasApiKey={!!groupConfig.apiKey}
            hasVisionApiKey={!!groupConfig.visionApiKey}
            model={groupConfig.model}
            systemPrompt={groupConfig.systemPrompt || ''}
            allowAll={groupConfig.allowAll}
            hasDefaultKey={!!admin.defaultApiKey}
          />
        </div>
      </section>

      {/* Usuarios habilitados */}
      {!groupConfig.allowAll && (
        <section>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
            Usuarios Habilitados ({groupConfig.users.length})
          </h2>
          <div style={cardStyle}>
            <UsersList
              groupId={groupConfig.id}
              users={groupConfig.users.map((u) => ({
                id: u.id,
                phoneNumber: u.phoneNumber,
                displayName: u.displayName,
                isEnabled: u.isEnabled,
              }))}
            />
          </div>
        </section>
      )}
    </div>
  );
}

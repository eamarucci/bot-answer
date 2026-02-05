import { getSession } from '@/lib/auth';
import { getGroupsByRelay } from '@/lib/mautrix-db';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DefaultKeysForm } from '@/components/default-keys-form';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/');

  // Busca admin com suas chaves default
  const admin = await prisma.admin.findUnique({
    where: { id: session.adminId },
    include: {
      groupConfigs: true,
    },
  });

  if (!admin) redirect('/');

  // Busca grupos onde o admin é relay (do banco do mautrix)
  const mautrixGroups = await getGroupsByRelay(session.phoneNumber);

  // Cria mapa de configs existentes
  const configsByRoomId = new Map(
    admin.groupConfigs.map((g) => [g.matrixRoomId, g])
  );

  // Combina dados do mautrix com configs do botanswer
  const groups = mautrixGroups.map((portal) => ({
    mxid: portal.mxid,
    name: portal.name || 'Grupo sem nome',
    config: configsByRoomId.get(portal.mxid) || null,
  }));

  const cardStyle: React.CSSProperties = {
    padding: '1.25rem',
    border: '1px solid var(--border)',
    borderRadius: '0.5rem',
    marginBottom: '1rem',
  };

  const hasDefaultKey = !!admin.defaultApiKey;

  return (
    <div>
      {/* Secao de chaves padrao */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Suas Chaves API Padrao
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '1rem' }}>
          Usadas em grupos que nao tem chave propria configurada.
        </p>

        <div style={cardStyle}>
          <DefaultKeysForm
            hasApiKey={!!admin.defaultApiKey}
            hasVisionApiKey={!!admin.defaultVisionApiKey}
          />
        </div>
      </section>

      {/* Secao de grupos */}
      <section>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Seus Grupos ({groups.length})
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '1rem' }}>
          Grupos onde voce é o relay. Configure !wa set-relay no grupo para adicionar novos.
        </p>

        {groups.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--muted-foreground)' }}>
            <p>Nenhum grupo encontrado.</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Configure o relay em um grupo com: !wa set-relay {session.phoneNumber}
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <Link
              key={group.mxid}
              href={`/dashboard/${encodeURIComponent(group.mxid)}`}
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <div
                style={{
                  ...cardStyle,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                      {group.name}
                    </h3>
                    <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
                      <p>
                        Chave API:{' '}
                        {group.config?.apiKey ? (
                          <span style={{ color: 'var(--success)' }}>Propria configurada</span>
                        ) : hasDefaultKey ? (
                          <span>Usando padrao</span>
                        ) : (
                          <span style={{ color: 'var(--destructive)' }}>Nao configurada</span>
                        )}
                      </p>
                      <p>
                        Modelo: {group.config?.model || 'auto'}
                      </p>
                      <p>
                        Acesso: {group.config?.allowAll !== false ? 'Todos podem usar' : 'Restrito'}
                      </p>
                    </div>
                  </div>
                  <span style={{ color: 'var(--muted-foreground)' }}>→</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}

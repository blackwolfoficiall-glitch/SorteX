import { AdminTeamRole, PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const prisma = new PrismaClient();

async function secret(question: string) {
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error('Para informar a senha com segurança, execute o comando em um terminal interativo ou use ADMIN_BOOTSTRAP_PASSWORD.');
  }
  output.write(question);
  input.setRawMode(true);
  input.resume();
  input.setEncoding('utf8');
  return new Promise<string>((resolve, reject) => {
    let value = '';
    const finish = () => { input.setRawMode(false); input.pause(); output.write('\n'); input.off('data', onData); resolve(value); };
    const onData = (key: string) => {
      if (key === '\u0003') { input.setRawMode(false); input.off('data', onData); reject(new Error('Operação cancelada.')); return; }
      if (key === '\r' || key === '\n') { finish(); return; }
      if (key === '\u007f') { value = value.slice(0, -1); return; }
      value += key;
    };
    input.on('data', onData);
  });
}

function strongPassword(value: string) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,}$/.test(value);
}

async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production') throw new Error('Criação de Superadministrador bloqueada em produção.');
  const current = await prisma.user.count({ where: { role: UserRole.ADMIN, adminTeamRole: AdminTeamRole.SUPERADMIN, isActive: true } });
  if (current > 0) throw new Error('Já existe um Superadministrador ativo. Convide outros membros pelo módulo Equipe.');

  const rl = createInterface({ input, output });
  const envMode = Boolean(process.env.ADMIN_BOOTSTRAP_EMAIL || process.env.ADMIN_BOOTSTRAP_NAME || process.env.ADMIN_BOOTSTRAP_PASSWORD);
  const name = (process.env.ADMIN_BOOTSTRAP_NAME ?? await rl.question('Nome completo: ')).trim();
  const email = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? await rl.question('E-mail: ')).trim().toLowerCase();
  rl.close();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? await secret('Senha: ');
  const confirmation = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? await secret('Confirme a senha: ');
  if (name.length < 2) throw new Error('Informe o nome completo.');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Informe um e-mail válido.');
  if (!strongPassword(password)) throw new Error('A senha deve possuir ao menos 12 caracteres, maiúscula, minúscula, número e símbolo.');
  if (password !== confirmation) throw new Error('As senhas não coincidem.');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !envMode) {
    const confirm = createInterface({ input, output });
    const answer = (await confirm.question('Esta conta já existe. Promover mantendo seus dados anteriores? (digite SIM): ')).trim();
    confirm.close();
    if (answer !== 'SIM') throw new Error('Promoção cancelada.');
  }
  if (existing && envMode && process.env.ADMIN_BOOTSTRAP_PROMOTE_EXISTING !== 'true') {
    throw new Error('Conta existente. Defina ADMIN_BOOTSTRAP_PROMOTE_EXISTING=true para confirmar a promoção pelo modo de ambiente.');
  }

  const hash = await bcrypt.hash(password, 12);
  const user = await prisma.$transaction(async (tx) => {
    const configured = existing
      ? await tx.user.update({ where: { id: existing.id }, data: { name, password: hash, role: UserRole.ADMIN, adminTeamRole: AdminTeamRole.SUPERADMIN, adminPermissions: [], status: UserStatus.ACTIVE, isActive: true, verified: true, forcePasswordReset: false } })
      : await tx.user.create({ data: { name, email, password: hash, role: UserRole.ADMIN, adminTeamRole: AdminTeamRole.SUPERADMIN, adminPermissions: [], status: UserStatus.ACTIVE, isActive: true, verified: true } });
    await tx.auditLog.create({ data: { actorUserId: configured.id, actorRole: UserRole.ADMIN, entityType: 'User', entityId: configured.id, action: 'FIRST_SUPERADMIN_CONFIGURED', newData: { adminTeamRole: AdminTeamRole.SUPERADMIN, promotedExistingUser: Boolean(existing) }, metadata: { source: envMode ? 'explicit-environment-command' : 'interactive-command' } } });
    return configured;
  });
  output.write(`Superadministrador configurado com segurança para ${user.email}.\n`);
  output.write('A senha não foi exibida nem registrada.\n');
}

main().catch((error) => { console.error(error instanceof Error ? error.message : 'Falha ao criar Superadministrador.'); process.exitCode = 1; }).finally(() => prisma.$disconnect());

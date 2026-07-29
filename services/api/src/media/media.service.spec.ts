import { BadRequestException } from '@nestjs/common';
import { MediaService } from './media.service';
describe('MediaService', () => {
  const s = new MediaService({} as any, {} as any);
  it('rejeita template sem versão e blocos', () =>
    expect(() => (s as any).validateDefinition({})).toThrow(
      BadRequestException,
    ));
  it('sanitiza scripts e sinais de HTML', () =>
    expect((s as any).clean('<script>x</script><b>Olá</b>')).toBe('bOlá/b'));
  it('escapa conteúdo para SVG', () =>
    expect((s as any).xml('<Maria & João>')).toBe('&lt;Maria &amp; João&gt;'));
  it('gera SVG nas dimensões solicitadas', () => {
    const svg = (s as any).renderSvg(
      1080,
      1920,
      { titulo: 'Campanha', premio: 'Moto' },
      {
        primaryColor: '#6D28D9',
        secondaryColor: '#111827',
        accentColor: '#22C55E',
        textColor: '#FFFFFF',
        publicName: 'Organizador',
      },
      { title: 'Card', verificationCode: 'ABC' },
    );
    expect(svg).toContain('width="1080"');
    expect(svg).toContain('height="1920"');
    expect(svg).toContain('Verificação: ABC');
  });
  it('não permite campos obrigatórios ausentes', () =>
    expect(() => (s as any).validateDefinition({ version: 1 })).toThrow());
});

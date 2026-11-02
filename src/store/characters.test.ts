import { describe, expect, it } from 'vitest';
import { CharacterStore, SheetError, addTrait, checkTraitsForProva, setWound } from './characters.js';
import { openDatabase } from './db.js';

const store = () => new CharacterStore(openDatabase(':memory:'));

describe('schede per utente', () => {
  it('ogni utente ha più PG e ne ha sempre uno attivo', () => {
    const s = store();
    s.create('u1', { name: 'Spike' });
    s.create('u1', { name: 'Vicious' });
    s.create('u2', { name: 'Faye' });
    expect(s.list('u1').map((c) => c.name)).toEqual(['Spike', 'Vicious']);
    expect(s.active('u1')?.name).toBe('Vicious');
    s.setActive('u1', 'spike');
    expect(s.active('u1')?.name).toBe('Spike');
    expect(s.active('u2')?.name).toBe('Faye');
  });

  it('eliminare il PG attivo ne attiva un altro', () => {
    const s = store();
    s.create('u1', { name: 'Spike' });
    s.create('u1', { name: 'Jet' });
    s.delete('u1', 'Jet');
    expect(s.active('u1')?.name).toBe('Spike');
  });

  it('i nomi sono unici per utente', () => {
    const s = store();
    s.create('u1', { name: 'Spike' });
    expect(() => s.create('u1', { name: 'spike' })).toThrow(SheetError);
    expect(() => s.create('u2', { name: 'Spike' })).not.toThrow();
  });

  it('salva tratti e ferite', () => {
    const s = store();
    let c = s.create('u1', { name: 'Faye', groove: 'artista-della-fuga' });
    c = addTrait(c, 'Rossetto Rosso', 'Tango');
    c = addTrait(c, 'Glock', 'Rock');
    c = setWound(c, 'glock', 1);
    s.save(c);
    const back = s.active('u1')!;
    expect(back.traits).toEqual([
      { name: 'Rossetto Rosso', slot: 'Tango', wound: 0 },
      { name: 'Glock', slot: 'Rock', wound: 1 },
    ]);
  });
});

describe('tratti utilizzabili in una Prova', () => {
  const s = store();
  let faye = s.create('u1', { name: 'Faye', groove: 'artista-della-fuga' });
  faye = addTrait(faye, 'Rossetto Rosso', 'Tango');
  faye = addTrait(faye, 'Glock', 'Rock');
  faye = addTrait(faye, 'Red Tail', 'MONO');

  it('il Groove presta i tratti Tango alle Prove Jazz', () => {
    expect(checkTraitsForProva(faye, ['Rossetto Rosso'], 'Jazz', false).errors).toEqual([]);
    expect(checkTraitsForProva(faye, ['Rossetto Rosso'], 'Rock', false).errors).toHaveLength(1);
  });

  it('i tratti del MONO valgono con ogni Approccio', () => {
    expect(checkTraitsForProva(faye, ['Red Tail'], 'Blues', false).ok).toHaveLength(1);
  });

  it('i tratti feriti non danno dadi, salvo Testa Dura con Svantaggio', () => {
    const hurt = setWound(faye, 'Glock', 1);
    expect(checkTraitsForProva(hurt, ['Glock'], 'Rock', false).errors).toHaveLength(1);
    const tough = { ...hurt, groove: 'testa-dura' as const };
    expect(checkTraitsForProva(tough, ['Glock'], 'Rock', true).ok).toHaveLength(1);
    expect(checkTraitsForProva(tough, ['Glock'], 'Rock', false).ok).toHaveLength(0);
  });

  it('massimo 3 tratti per esagono', () => {
    let c = faye;
    c = addTrait(c, 'A', 'Dance');
    c = addTrait(c, 'B', 'Dance');
    c = addTrait(c, 'C', 'Dance');
    expect(() => addTrait(c, 'D', 'Dance')).toThrow(SheetError);
  });
});

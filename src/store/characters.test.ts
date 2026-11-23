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
    expect(checkTraitsForProva(faye, ['Red Tail', 'red tail'], 'Blues', false).errors).toHaveLength(1);
  });

  it('massimo 3 tratti per esagono', () => {
    let c = faye;
    c = addTrait(c, 'A', 'Dance');
    c = addTrait(c, 'B', 'Dance');
    c = addTrait(c, 'C', 'Dance');
    expect(() => addTrait(c, 'D', 'Dance')).toThrow(SheetError);
  });
});

describe('Improvvisare e Jam', () => {
  const pg = () => {
    let c = store().create('u1', { name: 'Faye' });
    c = addTrait(c, 'Rossetto', 'Rock');
    return addTrait(c, 'Occhiata', 'Jazz');
  };

  it('Improvvisare apre i tratti di un secondo Approccio', () => {
    const c = pg();
    expect(checkTraitsForProva(c, ['Occhiata'], 'Rock', false).errors).toHaveLength(1);
    expect(checkTraitsForProva(c, ['Occhiata'], 'Rock', false, { improvvisa: 'Jazz' }).errors).toEqual([]);
  });

  it('Jam presta il Groove di un altro CT', () => {
    const c = pg();
    expect(checkTraitsForProva(c, ['Occhiata'], 'Dance', false).errors).toHaveLength(1);
    expect(checkTraitsForProva(c, ['Occhiata'], 'Dance', false, { groove: 'piu-rapido-di-uno-sguardo' }).errors).toEqual([]);
  });
});

describe('dado messo da parte', () => {
  it('si salva sulla scheda e si svuota', () => {
    const s = store();
    const c = s.create('u1', { name: 'Spike' });
    expect(c.reservedDie).toBeNull();
    expect(s.save({ ...c, reservedDie: 5 }) && s.byId(c.id)?.reservedDie).toBe(5);
    s.save({ ...c, reservedDie: null });
    expect(s.byId(c.id)?.reservedDie).toBeNull();
  });
});

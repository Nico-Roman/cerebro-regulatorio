// Huecos de la agenda con ventanas por día (migración 0011): cada día ofrece
// solo su propia franja, los inicios avanzan de a `pasoMin`, y una reserva
// borra las horas que se le traslapan, buffer incluido.

import assert from "node:assert/strict";
import { test } from "node:test";

import { generarSlots } from "../lib/agenda/slots.ts";
import { problemasVentanas, ventanasDesdeFila } from "../lib/agenda/ventanas.ts";

const ZONA = "America/Santiago";

const CONFIG = {
  duracionMin: 30,
  bufferMin: 15,
  pasoMin: 15,
  ventanas: [
    { dia: 1, inicio: "18:00", fin: "21:00" },
    { dia: 3, inicio: "18:00", fin: "21:00" },
    { dia: 5, inicio: "16:00", fin: "20:00" },
    { dia: 6, inicio: "09:00", fin: "13:00" },
    { dia: 7, inicio: "09:00", fin: "13:00" },
  ],
  zona: ZONA,
  antelacionHoras: 0,
  horizonteDias: 7,
};

// Lunes 19-10-2026 a las 00:00 en Santiago (UTC-3 en primavera).
const LUNES = new Date("2026-10-19T03:00:00.000Z");

const hora = (iso: string) =>
  new Intl.DateTimeFormat("es-CL", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(iso)
  );

test("cada día publica solo su ventana: martes y jueves no aparecen", () => {
  const dias = generarSlots(CONFIG, [], LUNES);
  assert.deepEqual(
    dias.map((d) => d.fecha),
    ["2026-10-19", "2026-10-21", "2026-10-23", "2026-10-24", "2026-10-25"]
  );
});

test("inicios cada 15 minutos y la última reunión termina al cierre", () => {
  const [lunes] = generarSlots(CONFIG, [], LUNES);
  const horas = lunes.slots.map((s) => hora(s.inicio));
  assert.equal(horas[0], "18:00");
  assert.equal(horas[1], "18:15");
  assert.equal(horas.at(-1), "20:30");
  assert.equal(horas.length, 11);
});

test("viernes desde las 16:00 y fin de semana en la mañana", () => {
  const dias = generarSlots(CONFIG, [], LUNES);
  const viernes = dias.find((d) => d.fecha === "2026-10-23")!;
  const sabado = dias.find((d) => d.fecha === "2026-10-24")!;
  assert.equal(hora(viernes.slots[0].inicio), "16:00");
  assert.equal(hora(viernes.slots.at(-1)!.inicio), "19:30");
  assert.equal(hora(sabado.slots[0].inicio), "09:00");
  assert.equal(hora(sabado.slots.at(-1)!.inicio), "12:30");
});

test("una reserva de 18:30 a 19:00 borra lo que se le traslapa más el buffer", () => {
  const ocupado = {
    inicio: new Date("2026-10-19T21:30:00.000Z"), // 18:30 en Santiago
    fin: new Date("2026-10-19T22:00:00.000Z"),
  };
  const [lunes] = generarSlots(CONFIG, [ocupado], LUNES);
  const horas = lunes.slots.map((s) => hora(s.inicio));
  // 18:00 terminaría 18:30, pegada a la reserva: el buffer de 15 la saca.
  assert.deepEqual(horas.slice(0, 2), ["19:15", "19:30"]);
});

test("una base sin ventanas sigue publicando el rango viejo", () => {
  const ventanas = ventanasDesdeFila({
    ventanas: null,
    diaInicio: 1,
    diaFin: 5,
    horaInicio: "10:00",
    horaFin: "12:00",
  });
  assert.equal(ventanas.length, 5);
  assert.deepEqual(ventanas[4], { dia: 5, inicio: "10:00", fin: "12:00" });
});

test("el panel rechaza ventanas incoherentes", () => {
  assert.equal(problemasVentanas(CONFIG.ventanas, 30).length, 0);
  assert.ok(problemasVentanas([], 30).length);
  assert.ok(problemasVentanas([{ dia: 6, inicio: "13:00", fin: "09:00" }], 30).length);
  assert.ok(problemasVentanas([{ dia: 6, inicio: "09:00", fin: "09:20" }], 30).length);
  assert.ok(
    problemasVentanas(
      [
        { dia: 6, inicio: "09:00", fin: "13:00" },
        { dia: 6, inicio: "15:00", fin: "17:00" },
      ],
      30
    ).length
  );
});

# -*- coding: utf-8 -*-
import io, re
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/styles.html'
s = io.open(p, encoding='utf8').read()

# tokens de workflow, claro y oscuro. Validados con validate_palette.js:
#   claro  L 0.43-0.77, croma >= .1, peor par adyacente DeltaE 8.9 deutan
#   oscuro L 0.48-0.67, peor par adyacente DeltaE 8.3 protan
tok = """  /* Un color por workflow del long tail. El orden es el de la cadencia
     (01..05) y es el orden en que se validaron: mover uno obliga a volver a
     correr validate_palette.js, porque lo que se valida son los pares
     ADYACENTES. El canal va como codificacion secundaria (linea continua o
     punteada), que es lo que hace legible el par verde/rosa en deutan. */
  --w1: #8B3FA8;   /* 01 estrena        morado */
  --w2: #B88400;   /* 02 perfilamiento  ámbar  */
  --w3: #0891B2;   /* 03 desembolso     cyan   */
  --w4: #BE185D;   /* 04 reactivar      rosa   */
  --w5: #166534;   /* 05 reconocimiento verde  */
"""
tokd = """  --w1: #A855C8;
  --w2: #B8890A;
  --w3: #1CA3C4;
  --w4: #E05A87;
  --w5: #15803D;
"""
a = s.index('  --s4: #1E8E5A;')
a = s.index('\n', a) + 1
s = s[:a] + tok + s[a:]
b = s.index('  --s4: #22A56B;')
b = s.index('\n', b) + 1
s = s[:b] + tokd + s[b:]

# CSS de los chips, ahora agrupados y coloreados por workflow
old = s[s.index('/* ------------------------------------------------- LONG TAIL (F7) */'):
         s.index('/* La cadencia como secuencia')]
new = """/* ------------------------------------------------- LONG TAIL (F7) */
/* Chips de impacto agrupados por workflow. El color del punto lo pone la
   variable --c que inyecta el JS, asi que la paleta vive en un solo lugar. */
.imp-chips { margin: 2px 0 8px; }
.imp-barra { display: flex; gap: 6px; margin-bottom: 6px; }
.imp-grupo {
  display: flex; flex-wrap: wrap; align-items: center; gap: 5px;
  padding: 5px 0; border-top: 1px solid var(--borde);
}
.imp-chip, .imp-todo, .imp-wf {
  font: inherit; font-size: 11px; cursor: pointer;
  border: 1px solid var(--borde); background: var(--superficie);
  color: var(--texto-3); border-radius: 999px; padding: 4px 9px;
  display: inline-flex; align-items: center; gap: 5px;
}
.imp-todo { font-weight: 700; color: var(--texto-2); }
.imp-wf {
  font-weight: 700; color: var(--texto); border-color: transparent;
  background: transparent; padding-left: 2px; min-width: 168px;
}
.imp-wf i { background: var(--c); width: 10px; height: 10px; }
.imp-wf small { color: var(--texto-3); font-weight: 400; }
.imp-chip.on { border-color: var(--c); color: var(--texto); font-weight: 600; }
.imp-chip:hover, .imp-todo:hover, .imp-wf:hover { border-color: var(--borde-fuerte); }
.imp-chip small { color: var(--texto-3); font-weight: 400; }
.imp-chip i, .imp-wf i, .cad-paso i {
  width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex: none;
  background: var(--c);
}
/* El canal, como en la grafica: WhatsApp relleno, email con el centro hueco.
   Asi el canal no depende del color, que ya esta gastado en el workflow. */
.imp-chip i.mail { background: transparent; border: 2px solid var(--c); }
.imp-chip:not(.on) { opacity: .5; }
.cad-paso i.wa { background: var(--s3); }
.cad-paso i.mail { background: var(--s2); }

"""
s = s.replace(old, new, 1)
io.open(p, 'w', encoding='utf8').write(s)
print('tokens y css ok')

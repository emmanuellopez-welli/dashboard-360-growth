# -*- coding: utf-8 -*-
import io
p = 'c:/Users/millo/OneDrive/Escritorio/Dashboard 360 mkt/apps_script/Filtro_Origen.gs'
s = io.open(p, encoding='utf8').read()

anc = """var ROLES = ["""
nuevo = """/* Quien aparece en cada selector de rol, por lista explicita del negocio.
   NO se infiere de los datos: las propiedades hunter/farmer/cs de HubSpot
   traen gente que ya no esta en el equipo o que quedo asignada por error
   (el hunter con 536 sedes es alguien inactivo; hay farmers con 1 sede que
   son un dedazo). Filtrar la LISTA y no los datos: esas sedes siguen
   contando en los totales, solo que no se puede filtrar por esa persona.

   Los ids van fijos y no por nombre a proposito: los nombres cortos del
   negocio no coinciden con los de HubSpot ("Lady Moreno" contra "LADY DIANA
   MORENO DURAN") y un match difuso se equivoca en silencio.

   Si entra o sale alguien del equipo, se edita esta lista. */
var GENTE_ROL = {
  hunter: {
    '83703393': 'Johanna Vásquez',
    '89418948': 'Gabriela Quitian',
    '83917986': 'Paola Carranza',
    '83703394': 'Hanheyr Pérez'
  },
  farmer: {
    '83703392': 'Guillermo Lenis',
    '84380856': 'Lady Moreno',
    '83703389': 'Edilberto Espitia',
    '83748989': 'Margarita Jaramillo',
    '84380859': 'Viviana Zuluaga',
    '83748988': 'Maryori Palacio',
    '83703390': 'Johana Quiroz',
    '84418150': 'Caterine Rios',
    '84380858': 'Giohanna Sanchez',
    '83748986': 'John Hinestroza',
    '94438568': 'Emmanuel Buitrago'
  },
  cs: {
    '84380860': 'Mariana Botero',
    '88454157': 'Lina Camacho'
  }
};

var ROLES = ["""
assert anc in s and 'GENTE_ROL' not in s
s = s.replace(anc, nuevo, 1)

# el catalogo se filtra por la lista, y usa el nombre corto del negocio
old = """    catalogoRoles: ROLES.map(function (R2) {
      var gente = [];
      Object.keys(catRol[R2.id]).forEach(function (oid) {
        if (oid === '0') return;
        gente.push({ id: oid, nombre: nomDe[oid] || oid, sedes: catRol[R2.id][oid] });
      });
      gente.sort(function (a, b) { return b.sedes - a.sedes; });
      var sinAsignar = catRol[R2.id]['0'] || 0;
      return { id: R2.id, nombre: R2.nombre, gente: gente,
               sinAsignar: sinAsignar };
    }),"""
new = """    catalogoRoles: ROLES.map(function (R2) {
      var permitida = GENTE_ROL[R2.id] || {};
      var gente = [], fuera = 0;
      Object.keys(catRol[R2.id]).forEach(function (oid) {
        if (oid === '0') return;
        if (!permitida[oid]) { fuera += catRol[R2.id][oid]; return; }
        // El nombre corto del negocio, no el de HubSpot: es el que la gente
        // reconoce en un selector.
        gente.push({ id: oid, nombre: permitida[oid], sedes: catRol[R2.id][oid] });
      });
      gente.sort(function (a, b) { return b.sedes - a.sedes; });
      return { id: R2.id, nombre: R2.nombre, gente: gente,
               sinAsignar: catRol[R2.id]['0'] || 0,
               // Sedes asignadas a alguien que no esta en la lista del rol.
               // Siguen contando en los totales; solo no son filtrables.
               fueraDeLista: fuera };
    }),"""
assert old in s
s = s.replace(old, new, 1)

io.open(p, 'w', encoding='utf8').write(s)

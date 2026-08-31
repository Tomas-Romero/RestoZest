# Cómo usar este bundle

Estos archivos van **dentro del repo de Resto Zest**, no se pegan en el chat.
Claude Code los lee solo.

## Instalación

```bash
mkdir resto-zest && cd resto-zest && git init
# copiá el contenido de este bundle en la raíz del repo
git add . && git commit -m "docs: plan técnico y configuración de Claude Code"
claude
```

Quedan así:

```
resto-zest/
├── CLAUDE.md                    ← se carga en TODA sesión. Mantenelo corto.
├── docs/
│   ├── ESTADO.md                ← la memoria entre sesiones. Se actualiza al cerrar cada una.
│   ├── plan/                    ← el plan completo, dividido. Se lee bajo demanda.
│   └── adr/                     ← decisiones de arquitectura
└── .claude/
    ├── rules/                   ← reglas que se cargan SOLO al tocar ciertas rutas
    │   ├── modelo-datos.md      → packages/db/**, migrations/**
    │   ├── sync-offline.md      → packages/sync/**, apps/hub/**
    │   └── apps-operativas.md   → apps/{pos,waiter,kds}/**
    └── skills/
        ├── fase/                → /fase 3
        └── cerrar-sesion/       → /cerrar-sesion
```

## El ciclo de trabajo

```
claude
> /fase 0                 # Claude parte la fase en sub-entregables y te los muestra
> [elegís uno]
  Shift+Tab → plan mode   # para que planifique sin tocar archivos
  Ctrl+G                  # editás el plan antes de aprobarlo
> [aprobás, codea]
> /cerrar-sesion          # corre tests, actualiza ESTADO.md, commitea
> /clear                  # empezás limpio el siguiente sub-entregable
```

## Reglas de higiene de contexto

- **Una sesión = un sub-entregable.** No una fase entera.
- `/clear` entre tareas. No hay nada que perder: la memoria vive en el código,
  en `ESTADO.md` y en los ADRs.
- `/context` te muestra qué está ocupando lugar. Si `CLAUDE.md` creció mucho,
  movele contenido a `.claude/rules/`.
- Si llegás al 25 % de contexto restante en medio de una tarea, no sigas empujando:
  pedí `/cerrar-sesion`, hacé `/clear` y retomá.
- `Esc` dos veces revierte cambios de archivos si algo salió mal.

## Para qué usar subagentes

Sirven para trabajo de lectura que ensuciaría tu conversación: buscar dónde está
definido algo en el monorepo, revisar un módulo entero, investigar documentación
externa. Devuelven un resumen y toda la lectura queda en su contexto, no en el tuyo.

No los uses para escribir el código principal: ese trabajo necesita el contexto
acumulado de la conversación con vos.

Para paralelizar de verdad, usá git worktrees:

```bash
git worktree add ../gc-kds feature/kds
cd ../gc-kds && claude
```

Dos worktrees, dos sesiones, cero conflictos. Solo tiene sentido en módulos que no
se pisan (por ejemplo `apps/kds` y `apps/client`).

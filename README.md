# Control de Insumos Ice Scroll

App web React + Firebase para controlar productos, stock, movimientos y reposición.

## Configuración

1. Crea un proyecto en Firebase con la cuenta `pesoutom@gmail.com`.
2. Activa Cloud Firestore.
3. Copia `.env.example` a `.env` y completa los valores de la configuración web de Firebase.
4. Publica las reglas de `firestore.rules`.

## Desarrollo

```bash
npm install
npm run dev
```

La app queda abierta, sin autenticación. Cualquier persona con acceso a la URL podrá leer y escribir datos si las reglas abiertas están publicadas.

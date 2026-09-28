# @aldi1963/temp-mail-api-client

React Query client untuk [Temp-Mail API](https://m.clipku.com/tempmail/api-docs), dibangkitkan otomatis dengan [Orval](https://orval.dev) dari `lib/api-spec/openapi.yaml`.

## Instalasi

```bash
npm install @aldi1963/temp-mail-api-client
```

> Paket ini dipublish di GitHub Packages. Tambahkan ke `.npmrc`:
>
> ```
> @aldi1963:registry=https://npm.pkg.github.com
> ```

## Pakai

```tsx
import { setBaseUrl, useGetInbox } from "@aldi1963/temp-mail-api-client";

setBaseUrl("https://m.clipku.com");

function Inbox({ email }: { email: string }) {
  const { data } = useGetInbox(email);
  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
```

Butuh `@tanstack/react-query` (v5) dan `react` >= 18 sebagai peer di aplikasi kamu.

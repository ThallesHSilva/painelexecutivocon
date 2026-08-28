# Implantação na VPS

O projeto roda como uma aplicação única, com SQLite e arquivos processados no volume Docker
`mapa-parque-data`. Não é necessário contratar banco ou armazenamento externo.

As bases comerciais não fazem parte do repositório. Após a primeira inicialização, carregue-as
pela página **Alimentar dados** ou restaure um backup do volume.

## Requisitos

- VPS Linux com Docker Engine e Docker Compose;
- pelo menos 4 GB de RAM para processar bases grandes;
- domínio ou túnel apontando para `http://127.0.0.1:8000`.

## Primeira implantação

```bash
git clone https://github.com/ThallesHSilva/vista-park-now.git
cd vista-park-now
cp .env.example .env
```

Edite `.env` e defina `AUTH_EMAIL`, `AUTH_PASSWORD_HASH`, `AUTH_SECRET` e `APP_ORIGIN`.
Gere uma chave de sessão com:

```bash
openssl rand -base64 48
```

Depois, suba a aplicação:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f mapa-parque
```

## Atualização da aplicação

```bash
git pull
docker compose up -d --build
```

O banco, os uploads QSC e os snapshots processados permanecem no volume mesmo quando o
container é recriado.

## Backup

Pare brevemente a aplicação para obter uma cópia consistente e compacte o volume:

```bash
docker compose stop mapa-parque
docker run --rm -v mapa-parque-data:/data -v "$PWD:/backup" alpine \
  tar -czf /backup/mapa-parque-backup.tar.gz -C /data .
docker compose start mapa-parque
```

O arquivo `mapa-parque-backup.tar.gz` contém usuários, vínculos, histórico das cargas e dados
processados. Guarde-o fora da VPS.

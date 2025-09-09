# HiperSend — Notificações Zabbix via WhatsApp

Template HiperSend para envio de notificações do Zabbix diretamente para WhatsApp.

## Recursos
- ✅ Envio de mensagens de texto para **contato privado** (número)
- ✅ Envio de mensagens de texto para **grupo**
- ✅ Conversão automática **HTML (Zabbix)** → **WhatsApp** (*bold*, _italic_, ```code```, links)
- ✅ Compatível com **Zabbix 7.2+** (HttpRequest)
- ✅ Proxy opcional, logs detalhados

---

## Instalação (Zabbix 7.2+)

1. Em **Administração → Tipos de mídia → Criar (Script)**.
2. Cole o conteúdo de [`scripts/hipersend-zabbix7.js`](scripts/hipersend-zabbix7.js).
3. **Parâmetros** da mídia (exemplos):
   - `Api` → `api-st2ngxjq9x3arj1vsvzf` *(u)*
   - `Secret` → `xxxxxxxxxxx` *(p)*
   - `To` → número `DDI+DDD+numero` **ou** ID de grupo (ex.: `xxxxx-xxxxx@g.us`)
   - `IsGroup` → `false` (padrão) ou `true`
   - `Format` → `auto` (padrão) ou `none`
   - `HTTPProxy` → opcional
   - `EndpointBase` → opcional (padrão `https://myhs.app`)
4. Defina o **Javascript script HTTP request timeout interval** conforme sua necessidade.
5. Clique em **Test** preenchendo `Subject` e `Message`.

### Como funciona
- **Direto para número**: `POST https://myhs.app/sendMessage` com body `{ u, p, to, msg }`
- **Grupo**: `POST https://myhs.app/sendMessageGroup` com body `{ u, p, to, msg }`
- Se `Format=auto`, o script converte HTML gerado pelo Zabbix em formatação WhatsApp:
  - `<b>`/`<strong>` → `*negrito*`
  - `<i>`/`<em>` → `_itálico_`
  - `<code>` → ```` ```monospace``` ````
  - `<a href>` → `texto (url)` ou `url`

### Exemplo (teste)
- `Subject`: `❌<b>INTERFACE DOWN</b>`
- `Message`: `⚠️<b>ether1</b> <i>down</i>`
- Saída no WhatsApp (com `Format=auto`):
  ```
  ❌*INTERFACE DOWN*
  ⚠️*ether1* _down_
  ```

---

## Mapeamento de campos (Zabbix → HiperSend)
| Zabbix Param | HiperSend Body |
|---|---|
| Api | u |
| Secret | p |
| To | to |
| Subject + "\n" + Message | msg |

---

## Envio por GET (opcional)
Se quiser usar GET (não recomendado para mensagens longas), a API aceita:
```
GET https://myhs.app/sendMessage?app=<app>&u=<u>&p=<p>&to=<to>&msg=<msg>
```
> O script padrão usa **POST JSON**. GET pode ser adicionado facilmente se houver demanda.

---

## Troubleshooting
- **HTTP 400 + `{"message":"nada a fazer"}`**  
  Verifique nomes dos campos (`u`, `p`, `to`, `msg`), endpoint correto (`/sendMessage` vs `/sendMessageGroup`) e se `to` está no formato certo:
  - Número: apenas dígitos com DDI+DDD+numero (ex.: `5511999888777`)
  - Grupo: id completo `...@g.us`
- **`Sending failed: ...`**  
  Veja o **Raw response** no “Media type test log”. O script já loga código e corpo.

---

## Changelog
Veja [`CHANGELOG.md`](CHANGELOG.md).

// HiperSend Webhook — Zabbix 7.2+
// - Envio DIRETO para número (POST JSON {u,p,to,msg}) — endpoint /sendMessage
// - Envio para GRUPO — endpoint /sendMessageGroup (mesmo payload {u,p,to,msg})
// - Conversão automática de HTML (Zabbix) -> WhatsApp (*bold*, _italic_, ```code```, links)

var HiperSend = {
    u: null,           // Api -> u
    p: null,           // Secret -> p
    to: null,          // To (número ou id de grupo)
    msg: null,         // Subject + '\n' + Message
    isGroup: false,    // força envio em grupo
    proxy: null,
    endpointBase: 'https://myhs.app',
    formatMode: 'auto', // 'auto' | 'none'

    _encodeForm: function (obj) {
        var out = [];
        for (var k in obj) {
            if (!obj.hasOwnProperty(k)) continue;
            var v = obj[k];
            if (v === null || typeof v === 'undefined') continue;
            out.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
        }
        return out.join('&');
    },

    _http: function (method, url, body, headers) {
        var req = new HttpRequest();
        if (this.proxy) req.setProxy(this.proxy);
        if (headers) for (var i = 0; i < headers.length; i++) req.addHeader(headers[i]);

        Zabbix.log(4, '[HiperSend] ' + method + ' ' + url.replace(String(this.u), '<API>'));

        var resp = (method === 'GET') ? req.get(url) : req.post(url, body);
        var status = req.getStatus();

        Zabbix.log(4, '[HiperSend] HTTP code: ' + status);
        Zabbix.log(4, '[HiperSend] Raw response: ' + (resp === null ? '<null>' : String(resp)));

        return { status: status, body: resp };
    },

    // Conversor HTML (Zabbix) -> WhatsApp
    _htmlToWhatsapp: function (s) {
        if (!s) return '';

        // <br>, <p>, <div>, <ul>, <ol>, <li>
        s = s.replace(/<(br|BR)\s*\/?>/g, '\n');
        s = s.replace(/<\/?(p|div|ul|ol)\b[^>]*>/gi, '\n');
        s = s.replace(/<li\b[^>]*>/gi, '• ');
        s = s.replace(/<\/li>/gi, '\n');

        // <b>/<strong> -> *texto*
        s = s.replace(/<(b|strong)\b[^>]*>([\s\S]*?)<\/\1>/gi, function (_, __, inner) {
            return '*' + inner + '*';
        });

        // <i>/<em> -> _texto_
        s = s.replace(/<(i|em)\b[^>]*>([\s\S]*?)<\/\1>/gi, function (_, __, inner) {
            return '_' + inner + '_';
        });

        // <code> -> ```texto```
        s = s.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, function (_, inner) {
            return '```' + inner + '```';
        });

        // Links: <a href="url">texto</a> -> "texto (url)" ou só url
        s = s.replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, function (_, href, text) {
            var t = (text || '').trim();
            if (!t || t === href) return href;
            return t + ' (' + href + ')';
        });

        // Remove âncoras vazias
        s = s.replace(/<a\b[^>]*>\s*<\/a>/gi, '');

        // Remove tags restantes
        s = s.replace(/<\/?[^>]+>/g, '');

        // Entidades básicas
        var map = { '&lt;':'<', '&gt;':'>', '&amp;':'&', '&quot;':'"', '&#39;':"'", '&apos':"'" };
        s = s.replace(/&(lt|gt|amp|quot|#39|apos);/g, function (m) { return map[m] || m; });

        // Limpeza
        s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');

        return s;
    },

    send: function () {
        // Heurística opcional: se terminar com @g.us ou muito longo, trata como grupo
        var autoGroup = false;
        if (typeof this.to === 'string') {
            if (/@g\.us$/i.test(this.to) || this.to.length > 17) autoGroup = true;
        }
        var useGroup = !!this.isGroup || autoGroup;

        // Endpoint correto
        var endpoint = this.endpointBase + (useGroup ? '/sendMessageGroup' : '/sendMessage');

        // Normaliza destino
        var toValue = String(this.to);
        if (!useGroup) {
            // envio direto para número: somente dígitos (DDI+DDD+numero)
            toValue = toValue.replace(/\D+/g, '');
        }

        // Converte formatação se necessário
        var msgValue = String(this.msg || '');
        if (this.formatMode === 'auto') {
            msgValue = this._htmlToWhatsapp(msgValue);
        }

        var payload = { u: this.u, p: this.p, to: toValue, msg: msgValue };

        var headers = ['Content-Type: application/json', 'Accept: application/json'];
        var body = JSON.stringify(payload);

        Zabbix.log(4, '[HiperSend] Endpoint: ' + endpoint);
        Zabbix.log(4, '[HiperSend] Payload(JSON): ' + body);

        var r = this._http('POST', endpoint, body, headers);

        // sucesso esperado: 201 (aceita qualquer 2xx)
        if (r.status >= 200 && r.status < 300) {
            try {
                var obj = r.body ? JSON.parse(r.body) : null;
                if (obj && obj.result && obj.result !== 'success') {
                    throw 'HTTP ' + r.status + ' - ' + r.body;
                }
            } catch (e) { /* corpo não-JSON: ok */ }
            return;
        }

        throw 'HTTP ' + r.status + ' - ' + (r.body ? r.body : 'sem corpo de resposta');
    }
};

try {
    var p = JSON.parse(value);

    // Obrigatórios
    if (typeof p.Api === 'undefined')    throw 'Incorrect value is given for parameter "Api": parameter is missing';
    if (typeof p.Secret === 'undefined') throw 'Incorrect value is given for parameter "Secret": parameter is missing';
    if (typeof p.To === 'undefined')     throw 'Incorrect value is given for parameter "To": parameter is missing';

    HiperSend.u   = p.Api;
    HiperSend.p   = p.Secret;
    HiperSend.to  = p.To;

    // Concatena Subject + Message (Zabbix tende a gerar HTML)
    var subj = String(p.Subject || '');
    var body = String(p.Message || '');
    HiperSend.msg = (subj ? subj : '') + (subj && body ? '\n' : '') + body;

    // Opcionais
    if (p.HTTPProxy)     HiperSend.proxy = p.HTTPProxy;
    if (p.EndpointBase)  HiperSend.endpointBase = p.EndpointBase; // default: https://myhs.app
    if (typeof p.IsGroup !== 'undefined') {
        HiperSend.isGroup = String(p.IsGroup).toLowerCase() === 'true';
    }
    if (p.Format && String(p.Format).toLowerCase() === 'none') {
        HiperSend.formatMode = 'none';
    }

    HiperSend.send();
    return 'OK';

} catch (err) {
    Zabbix.log(4, '[HiperSend] notification failed: ' + err);
    throw 'Sending failed: ' + err + '.';
}

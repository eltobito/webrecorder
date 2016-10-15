(function() {
    var ws;
    var useWS = false;
    var errCount = 0;

    var user;
    var coll;
    var rec;
    var host;

    var on_openned;

    var is_autoscroll = false;

    var start = function(_user, _coll, _rec, _host, _on_openned) {
        user = _user;
        coll = _coll;
        rec = _rec;
        host = _host;

        on_openned = _on_openned;

        if (!host) {
            host = window.location.host;
        }

        initWS();
    }

    var initWS = function() {
        var url = window.location.protocol == "https:" ? "wss://" : "ws://";
        //var url = "ws://";
        url += host + "/_client_ws_cont?";
        url += "user=" + user + "&coll=" + coll;

        if (rec && rec != "*") {
            url += "&rec=" + rec;
        }
        url += "&cont_browser=1";

        try {
            ws = new WebSocket(url);

            ws.addEventListener("open", ws_openned);
            ws.addEventListener("message", ws_received);
            ws.addEventListener("close", ws_closed);
            ws.addEventListener("error", ws_closed);
        } catch (e) {
            useWS = false;
        }
    }

    function ws_openned() {
        useWS = true;
        errCount = 0;

        if (on_openned) {
            on_openned();
        }
    }

    function ws_closed() {
        useWS = false;
        if (errCount < 5) {
            errCount += 1;
            setTimeout(initWS, 2000);
        }
    }
 
    function addCookie(name, value, domain) {
        var msg = {"ws_type": "addcookie",
                   "name": name,
                   "value": value,
                   "domain": domain}

        return sendMsg(msg);
    }

    function addSkipReq(url) {
        var msg = {"ws_type": "skipreq",
                   "url": url
                  }

        return sendMsg(msg);
    }

    function sendReqPatch(url) {
        var msg = {"ws_type": "req_switch",
                   "url": url
                  }

        return sendMsg(msg);
    }

    function sendPageMsg(isAdd) {
        var page = {
                 "url": window.location.href,
                 "timestamp": wbinfo.timestamp,
                 "title": document.title,
                 "browser": wbinfo.curr_browser,
        };

        var msg = {"page": page}

        if (isAdd) {
            msg["ws_type"] = "page";
            msg["visible"] = !document.hidden;
        } else {
            msg["ws_type"] = "remote_url";
        }

        return sendMsg(msg);
    }

    function sendMsg(msg) {
        if (!hasWS()) {
            return false;
        }

        ws.send(JSON.stringify(msg));
        return true;
    }
 
    function ws_received(event)
    {
        var msg = JSON.parse(event.data);
        
        switch (msg.ws_type) {
            case "status":
                break;

            case "set_url":
                if (!document.hidden && msg.url != window.location.href) {
                    window.location.href = msg.url;
                }
                break;

            case "autoscroll":
                if (!document.hidden) {
                    sendLocalMsg({"wb_type": "autoscroll",
                                  "start": !is_autoscroll,
                                  "timeout": 25000});

                    is_autoscroll = !is_autoscroll;
                }
                break;

            case "switch":
                window.location.reload();
                break;

            case "snapshot-req":
                if (!document.hidden) {
                    sendLocalMsg({"wb_type": "snapshot-req"});
                }
                break;

            case "load_all":
                if (!document.hidden) {
                    load_all_links();
                }
                break;

            default:
                console.log(msg);
        }
    }

    function hasWS() {
        return useWS;
    }

    function sendLocalMsg(data) {
        window.dispatchEvent(new CustomEvent("__wb_to_event", {"detail": data}));
    }

    // INIT
    window.addEventListener("DOMContentLoaded", function() {
        if (window != window.top) {
            return;
        }

        function on_init() {
            sendPageMsg(wbinfo.is_live);
        }

        start(wbinfo.proxy_user, wbinfo.proxy_coll, wbinfo.proxy_rec, wbinfo.proxy_magic, on_init);
    });

    // VIZ CHANGE
    document.addEventListener("visibilitychange", function() {
        if (!document.hidden) {
            sendPageMsg(false);
        }
    });

    function localEvent(event) {
        var message = event.detail;
        if (!message) {
            return;
        }

        console.log(message);

        if (message.wb_type == "skipreq" ||
            message.wb_type == "patch_req") {

            message.ws_type = message.wb_type;
            delete message.wb_type;

            sendMsg(message);
        } else if (message.wb_type == "snapshot") {
            message.params.user_agent = navigator.userAgent;
            message.ws_type = "snapshot";

            var contents = message.contents;

            message.contents = "";

            sendMsg(message);
            ws.send(contents);
        }
    }

    window.addEventListener("__wb_from_event", localEvent);

    function load_all_links() {
        function get_links(query, win, store) {
            try {
                var results = win.document.querySelectorAll(query);
            } catch (e) {
                console.log("skipping foreign frame");
                return;
            }

            for (var i = 0; i < results.length; i++) {
                var link = results[i].href;
                if (!link || link.charAt(0) == "#") {
                    continue;
                }

                store[link] = 1;
            }

            for (var i = 0; i < win.frames.length; i++) {
                get_links(query, win.frames[i], store);
            }
        }

        var link_map = {};

        get_links("a[href]", window, link_map);

        console.log(link_map);

        for (var link in link_map) {
            window.open(link);
        }
    }

})();

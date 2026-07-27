(function () {
  'use strict';

  // 判断 URL 是否同时包含 graphql 和 HomeTimeline
  function isTargetUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return url.includes('graphql') && url.includes('HomeTimeline');
  }

  // 1. 核心广告判断逻辑
  function isAdEntry(entry) {
    if (!entry || typeof entry !== 'object') return false;

    // 检查 entryId
    if (typeof entry.entryId === 'string' && entry.entryId.toLowerCase().includes('promoted')) {
      return true;
    }

    // 检查 itemContent
    const itemContent = entry.itemContent || entry.content?.itemContent;
    if (itemContent) {
      if (itemContent.promotedMetadata || itemContent.itemType === 'TimelineItemPromoted') {
        return true;
      }
      const tweetResult = itemContent.tweet_results?.result;
      if (tweetResult && (tweetResult.promotedMetadata || tweetResult.source === 'Promoted')) {
        return true;
      }
    }

    // 兜底检查
    if (entry.promotedMetadata || entry.placementTracking) {
      return true;
    }

    return false;
  }

  // 2. 递归过滤数据
  function filterAdsFromTimeline(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj
        .filter(item => {
          const isAd = isAdEntry(item);
          if (isAd) {
            console.log('⚡ [X-AdBlocker] 成功拦截广告条目！', item);
          }
          return !isAd;
        })
        .map(item => filterAdsFromTimeline(item));
    }

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        obj[key] = filterAdsFromTimeline(obj[key]);
      }
    }

    return obj;
  }

  // 处理文本并过滤广告
  function processJsonText(rawText) {
    try {
      let data = JSON.parse(rawText);
      data = filterAdsFromTimeline(data);
      return JSON.stringify(data);
    } catch (e) {
      return rawText;
    }
  }

  // ================= 1. 改进 XHR 拦截：使用 getter 代理提前过滤 =================

  // 保存原生 XHR 原型上的 getter，用于在自定义 getter 中读取真实值
  const xhrProto = XMLHttpRequest.prototype;
  const nativeGetResponseText = Object.getOwnPropertyDescriptor(xhrProto, 'responseText').get;
  const nativeGetResponse = Object.getOwnPropertyDescriptor(xhrProto, 'response').get;

  const originalOpen = xhrProto.open;
  const originalSend = xhrProto.send;

  xhrProto.open = function (method, url) {
    this._url = url;
    return originalOpen.apply(this, arguments);
  };

  xhrProto.send = function () {
    if (isTargetUrl(this._url)) {
      const self = this;
      let filteredText = null;

      // 在 send() 时立刻用 getter 代理 responseText，
      // 确保 X 代码在任意时机（readyState 3 流式读取 / state 4 事件回调）读取时都拿到过滤后的数据
      Object.defineProperty(self, 'responseText', {
        get() {
          const raw = nativeGetResponseText.call(self);
          if (self.readyState === 4 && self.status === 200 && typeof raw === 'string' && raw.trim().startsWith('{')) {
            if (filteredText === null) {
              console.log('🎯 [X-AdBlocker] XHR 成功捕获 GraphQL 目标数据包:', self._url);
              filteredText = processJsonText(raw);
            }
            return filteredText;
          }
          return raw;
        },
        configurable: true,
        enumerable: true
      });

      Object.defineProperty(self, 'response', {
        get() {
          const raw = nativeGetResponse.call(self);
          if (self.readyState === 4 && self.status === 200 && typeof raw === 'string' && raw.trim().startsWith('{')) {
            if (filteredText === null) {
              console.log('🎯 [X-AdBlocker] XHR 成功捕获 GraphQL 目标数据包:', self._url);
              filteredText = processJsonText(raw);
            }
            return filteredText;
          }
          return raw;
        },
        configurable: true,
        enumerable: true
      });
    }

    return originalSend.apply(this, arguments);
  };

  // ================= 2. 安全拦截 fetch =================
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;

    // 💡 改动点：精准同时匹配 graphql 和 HomeTimeline
    if (isTargetUrl(url)) {
      try {
        console.log('🎯 [X-AdBlocker] Fetch 成功捕获 GraphQL 目标数据包:', url);
        const clone = response.clone();
        let data = await clone.json();

        data = filterAdsFromTimeline(data);

        const newHeaders = new Headers(response.headers);
        newHeaders.delete('content-encoding');

        return new Response(JSON.stringify(data), {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      } catch (e) {
        console.warn('[X-AdBlocker] Fetch 解析失败，退回原始数据:', e);
        return response;
      }
    }

    return response;
  };

  console.log('✅ [X-AdBlocker] 精准配置 (GraphQL + HomeTimeline) 已就绪！');
})();
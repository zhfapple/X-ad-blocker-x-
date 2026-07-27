// 在页面最顶层注入 inject.js
function injectScript(file_path) {
  const container = document.documentElement || document.head;
  const script = document.createElement('script');
  script.setAttribute('type', 'text/javascript');
  script.setAttribute('src', chrome.runtime.getURL(file_path));
  
  container.insertBefore(script, container.firstChild);
  script.onload = function () {
    script.remove(); // 注入成功后移除 script 节点，保持 DOM 整洁
  };
}

// 立即执行注入
injectScript('inject.js');
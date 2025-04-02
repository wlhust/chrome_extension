// 全局变量，存储已翻译的推文
let translatedTweets = {};

// 调试模式，帮助定位问题
const DEBUG = true;

function log(...args) {
  if (DEBUG) {
    console.log('%c[Twitter/X翻译助手]', 'color: #1DA1F2; font-weight: bold;', ...args);
  }
}

// 添加翻译按钮的主函数
function addTranslateButtons() {
  log('开始检测推文...');
  
  // 推文选择器，尝试多种可能的选择器
  const tweetSelectors = [
    'article[data-testid="tweet"]',
    'div[data-testid="tweet"]',
    'div[data-testid="tweetDetail"]',
    'article',
    'div[role="article"]'
  ];
  
  // 尝试不同的选择器
  let tweets = [];
  for (const selector of tweetSelectors) {
    const foundTweets = document.querySelectorAll(`${selector}:not([data-translate-button="added"])`);
    if (foundTweets.length > 0) {
      log(`找到${foundTweets.length}条推文，使用选择器: ${selector}`);
      tweets = foundTweets;
      break;
    }
  }
  
  log(`找到${tweets.length}条待处理的推文`);
  
  tweets.forEach(tweet => {
    // 标记该推文已添加按钮
    tweet.setAttribute('data-translate-button', 'added');
    
    // 获取推文ID
    const tweetId = getTweetId(tweet);
    if (!tweetId) {
      log('无法获取推文ID，跳过');
      return;
    }
    
    // 创建翻译按钮
    const translateButton = document.createElement('button');
    translateButton.className = 'translate-button';
    translateButton.textContent = '翻译';
    translateButton.setAttribute('data-tweet-id', tweetId);
    
    // 添加点击事件
    translateButton.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      handleTranslateClick(tweet, tweetId);
    });
    
    // 尝试多个可能的操作区域位置
    const actionBarSelectors = [
      '[role="group"]',
      'div[role="group"]',
      '.r-1kbdv6j', // Twitter常用的操作区CSS类
      '.r-18u37iz',
      'div[data-testid="reply"], div[data-testid="retweet"]' // 如果能找到回复或转发按钮
    ];
    
    let inserted = false;
    
    for (const selector of actionBarSelectors) {
      const actionsBar = tweet.querySelector(selector);
      if (actionsBar) {
        log(`找到操作区域: ${selector}`);
        
        // 创建一个容器，以匹配Twitter的样式
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'translate-button-container';
        buttonContainer.appendChild(translateButton);
        
        // 插入按钮
        actionsBar.appendChild(buttonContainer);
        inserted = true;
        log(`成功在${selector}中插入翻译按钮`);
        break;
      }
    }
    
    // 如果找不到操作区，尝试在推文内容后面插入
    if (!inserted) {
      log('找不到标准操作区，尝试替代插入位置');
      
      // 尝试查找推文文本元素
      const tweetTextSelectors = [
        '[data-testid="tweetText"]',
        'div[lang]', // 推文内容通常有lang属性
        'div[dir="auto"]', // 推文内容通常有dir属性
      ];
      
      for (const selector of tweetTextSelectors) {
        const tweetText = tweet.querySelector(selector);
        if (tweetText && tweetText.parentNode) {
          const buttonContainer = document.createElement('div');
          buttonContainer.className = 'translate-button-container standalone';
          buttonContainer.appendChild(translateButton);
          
          tweetText.parentNode.insertBefore(buttonContainer, tweetText.nextSibling);
          inserted = true;
          log(`成功在推文文本${selector}后插入翻译按钮`);
          break;
        }
      }
    }
    
    // 最后的努力 - 直接添加到推文元素末尾
    if (!inserted) {
      log('使用后备方法插入按钮');
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'translate-button-container standalone';
      buttonContainer.appendChild(translateButton);
      
      tweet.appendChild(buttonContainer);
      log('将按钮直接附加到推文元素');
    }
  });
}

// 从推文元素中提取推文ID
function getTweetId(tweetElement) {
  // 尝试从链接中获取推文ID
  const linkSelectors = [
    'a[href*="/status/"]',
    'a[href*="/statuses/"]',
    'a[href*="twitter.com"]'
  ];
  
  for (const selector of linkSelectors) {
    const linkElement = tweetElement.querySelector(selector);
    if (linkElement) {
      const match = linkElement.href.match(/\/status(?:es)?\/(\d+)/);
      if (match && match[1]) {
        log(`从链接中提取到推文ID: ${match[1]}`);
        return match[1];
      }
    }
  }
  
  // 备用方法：如果无法从链接获取，使用元素的data属性
  const dataIdElement = tweetElement.querySelector('[data-tweet-id]');
  if (dataIdElement && dataIdElement.getAttribute('data-tweet-id')) {
    return dataIdElement.getAttribute('data-tweet-id');
  }
  
  // 最后的备用方法：生成一个随机ID
  const randomId = 'tweet_' + Math.random().toString(36).substr(2, 9);
  log(`无法获取真实推文ID，使用随机ID: ${randomId}`);
  return randomId;
}

// 处理翻译按钮点击
function handleTranslateClick(tweetElement, tweetId) {
  log(`处理推文ID为${tweetId}的翻译请求`);
  
  // 检查是否已经翻译
  if (translatedTweets[tweetId]) {
    log('该推文已翻译，切换显示状态');
    toggleTranslation(tweetElement, tweetId);
    return;
  }
  
  // 查找推文文本内容
  const tweetTextSelectors = [
    '[data-testid="tweetText"]',
    'div[lang]',
    'div[dir="auto"]'
  ];
  
  let tweetTextElement = null;
  for (const selector of tweetTextSelectors) {
    tweetTextElement = tweetElement.querySelector(selector);
    if (tweetTextElement) {
      log(`找到推文文本元素: ${selector}`);
      break;
    }
  }
  
  if (!tweetTextElement) {
    log('无法找到推文文本元素');
    alert('无法找到推文文本');
    return;
  }
  
  const originalText = tweetTextElement.textContent;
  log(`推文原文: ${originalText.substring(0, 50)}...`);
  
  // 显示加载状态
  const translateButton = tweetElement.querySelector('.translate-button');
  const originalButtonText = translateButton.textContent;
  translateButton.textContent = '翻译中...';
  translateButton.disabled = true;
  
  // 发送消息给background script进行翻译
  log('发送翻译请求到后台');
  chrome.runtime.sendMessage(
    { action: 'translate', text: originalText },
    function(response) {
      translateButton.textContent = originalButtonText;
      translateButton.disabled = false;
      
      if (response && response.translatedText) {
        log(`收到翻译结果: ${response.translatedText.substring(0, 50)}...`);
        
        // 保存翻译结果
        translatedTweets[tweetId] = {
          originalText,
          translatedText: response.translatedText
        };
        
        // 显示翻译结果
        displayTranslation(tweetElement, tweetId, response.translatedText);
      } else {
        log('翻译失败', response?.error || '未知错误');
        alert('翻译失败: ' + (response?.error || '未知错误'));
      }
    }
  );
}

// 显示翻译结果
function displayTranslation(tweetElement, tweetId, translatedText) {
  log(`为推文ID ${tweetId} 显示翻译结果`);
  
  // 检查是否已经存在翻译容器
  let translationContainer = tweetElement.querySelector('.tweet-translation');
  
  if (!translationContainer) {
    // 创建翻译结果容器
    translationContainer = document.createElement('div');
    translationContainer.className = 'tweet-translation';
    translationContainer.setAttribute('data-tweet-id', tweetId);
    
    // 查找插入位置（推文文本元素后）
    const tweetTextSelectors = [
      '[data-testid="tweetText"]',
      'div[lang]',
      'div[dir="auto"]'
    ];
    
    let inserted = false;
    for (const selector of tweetTextSelectors) {
      const tweetTextElement = tweetElement.querySelector(selector);
      if (tweetTextElement && tweetTextElement.parentNode) {
        tweetTextElement.parentNode.insertBefore(translationContainer, tweetTextElement.nextSibling);
        inserted = true;
        log(`将翻译结果插入到${selector}后`);
        break;
      }
    }
    
    // 如果无法找到合适的插入位置，直接添加到推文末尾
    if (!inserted) {
      tweetElement.appendChild(translationContainer);
      log('将翻译结果直接添加到推文末尾');
    }
  }
  
  // 设置翻译内容
  translationContainer.textContent = translatedText;
  translationContainer.style.display = 'block';
  
  // 更新按钮文本
  const translateButton = tweetElement.querySelector('.translate-button');
  if (translateButton) {
    translateButton.textContent = '显示原文';
  }
}

// 切换显示原文/翻译
function toggleTranslation(tweetElement, tweetId) {
  log(`切换推文ID ${tweetId} 的翻译显示状态`);
  
  const translationContainer = tweetElement.querySelector('.tweet-translation');
  const translateButton = tweetElement.querySelector('.translate-button');
  
  if (!translationContainer || !translateButton) {
    log('找不到翻译容器或按钮');
    return;
  }
  
  if (translationContainer.style.display === 'none') {
    // 显示翻译
    translationContainer.style.display = 'block';
    translateButton.textContent = '显示原文';
    log('显示翻译');
  } else {
    // 显示原文
    translationContainer.style.display = 'none';
    translateButton.textContent = '显示翻译';
    log('显示原文');
  }
}

// 使用MutationObserver监听DOM变化
function observeTwitterChanges() {
  log('开始监听Twitter页面变化');
  
  const observer = new MutationObserver(function(mutations) {
    let needToAddButtons = false;
    
    mutations.forEach(function(mutation) {
      if (mutation.addedNodes && mutation.addedNodes.length > 0) {
        for (let i = 0; i < mutation.addedNodes.length; i++) {
          const node = mutation.addedNodes[i];
          if (node.nodeType === 1) { // 元素节点
            if (node.tagName === 'ARTICLE' || 
                node.querySelector('article') || 
                node.getAttribute('role') === 'article' ||
                node.querySelector('[role="article"]') ||
                node.querySelector('[data-testid="tweet"]')) {
              needToAddButtons = true;
              break;
            }
          }
        }
      }
    });
    
    if (needToAddButtons) {
      log('检测到新推文添加，添加翻译按钮');
      addTranslateButtons();
    }
  });
  
  // 观察整个文档的变化
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  log('Twitter页面观察器已启动');
}

// 初始执行
function init() {
  log('初始化Twitter翻译助手');
  
  // 确保Twitter页面已加载
  if (!document.body) {
    log('页面主体尚未加载，等待DOMContentLoaded事件');
    document.addEventListener('DOMContentLoaded', init);
    return;
  }
  
  // 检查API密钥是否已设置
  chrome.storage.sync.get(['tencentSecretId', 'tencentSecretKey'], function(result) {
    if (!result.tencentSecretId || !result.tencentSecretKey) {
      log('API密钥未设置，显示提示');
      
      // 显示设置提示
      const settingsTip = document.createElement('div');
      settingsTip.className = 'translate-settings-tip';
      settingsTip.textContent = '请点击扩展图标设置腾讯云API密钥以启用Twitter翻译功能';
      document.body.appendChild(settingsTip);
      
      // 3秒后自动隐藏
      setTimeout(() => {
        settingsTip.style.opacity = '0';
        setTimeout(() => {
          if (settingsTip.parentNode) {
            settingsTip.parentNode.removeChild(settingsTip);
          }
        }, 500);
      }, 3000);
    }
  });
  
  // 首次添加翻译按钮
  setTimeout(() => {
    log('初始运行添加翻译按钮');
    addTranslateButtons();
  }, 1500);
  
  // 开始观察DOM变化
  observeTwitterChanges();
  
  // 定期检查，以防某些推文未被处理
  setInterval(() => {
    log('定期检查未处理的推文');
    addTranslateButtons();
  }, 5000);
  
  log('初始化完成');
}

// 当页面加载完成后执行初始化
if (document.readyState === 'loading') {
  log('页面正在加载，等待DOMContentLoaded事件');
  document.addEventListener('DOMContentLoaded', init);
} else {
  log('页面已加载，立即初始化');
  init();
} 
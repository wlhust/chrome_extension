// 缓存翻译结果
const translationCache = {};

// 调试模式
const DEBUG = true;

function log(...args) {
  if (DEBUG) {
    console.log('%c[Twitter/X翻译助手-后台]', 'color: #1DA1F2; font-weight: bold;', ...args);
  }
}

// 腾讯云翻译API配置
const TENCENT_CLOUD_CONFIG = {
  // 这些值应该由用户在扩展设置中填写
  secretId: '',
  secretKey: '',
  region: 'ap-guangzhou', // 默认使用广州区域
  endpoint: 'tmt.tencentcloudapi.com',
  service: 'tmt',
  version: '2018-03-21',
  action: 'TextTranslate',
};

// 从存储中加载API密钥
function loadApiKeys() {
  return new Promise((resolve) => {
    log('从存储中加载API密钥');
    chrome.storage.sync.get(
      ['tencentSecretId', 'tencentSecretKey', 'tencentRegion', 'targetLanguage'],
      (result) => {
        if (result.tencentSecretId) {
          TENCENT_CLOUD_CONFIG.secretId = result.tencentSecretId;
          log('已加载SecretId');
        } else {
          log('未找到SecretId');
        }
        
        if (result.tencentSecretKey) {
          TENCENT_CLOUD_CONFIG.secretKey = result.tencentSecretKey;
          log('已加载SecretKey');
        } else {
          log('未找到SecretKey');
        }
        
        if (result.tencentRegion) {
          TENCENT_CLOUD_CONFIG.region = result.tencentRegion;
          log(`API区域设置为: ${result.tencentRegion}`);
        }
        
        // 目标语言不在这里使用，但我们仍然记录它
        if (result.targetLanguage) {
          log(`目标语言设置为: ${result.targetLanguage}`);
        } else {
          log('使用默认目标语言: zh (中文)');
        }
        
        resolve();
      }
    );
  });
}

// 生成签名所需的日期字符串
function getDate(timestamp) {
  const date = new Date(timestamp);
  return date.toISOString().substr(0, 10); // 保留ISO日期格式中的连字符 YYYY-MM-DD
}

// SHA-1 哈希函数 (需要使用Web Crypto API)
async function sha1(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// SHA-256 哈希函数
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// HMAC-SHA256 函数 - 返回十六进制字符串 (用于最终签名)
async function hmacSha256Hex(key, message) {
  const signature = await hmacSha256Binary(key, message);
  // 将签名的 ArrayBuffer 转换为十六进制字符串
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// HMAC-SHA256 函数 - 返回 ArrayBuffer (用于中间派生密钥)
async function hmacSha256Binary(key, message) {
  let keyBuffer;
  // 如果 key 是 ArrayBuffer 或 TypedArray，直接使用
  if (key instanceof ArrayBuffer || ArrayBuffer.isView(key)) {
    keyBuffer = key;
  } else {
    // 否则假定 key 是字符串，进行编码
    keyBuffer = new TextEncoder().encode(key);
  }
  const messageBuffer = new TextEncoder().encode(message);

  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      messageBuffer
    );

    return signature; // 返回原始的 ArrayBuffer
  } catch (error) {
    log('HMAC-SHA256计算错误', error);
    // 抛出更具体的错误可能有助于调试
    if (error.message.includes('Algorithm key derivation')) {
       throw new Error('HMAC-SHA256 密钥派生错误: ' + error.message);
    } else if (error.message.includes('importKey')) {
       throw new Error('HMAC-SHA256 importKey 错误: ' + error.message);
    } else {
       throw new Error('HMAC-SHA256 签名错误: ' + error.message);
    }
  }
}

// 生成腾讯云API的授权签名
async function generateSignature(params) {
  try {
    log('开始生成API签名');
    // 创建规范请求字符串
    const timestamp = Math.floor(Date.now() / 1000);
    const date = getDate(timestamp * 1000);

    // 1. 创建规范请求字符串
    const httpRequestMethod = 'POST';
    const canonicalUri = '/';
    const canonicalQueryString = '';

    // 创建规范头部 (确保key小写)
    const canonicalHeaders =
      'content-type:application/json\n' +
      'host:' + TENCENT_CLOUD_CONFIG.endpoint.toLowerCase() + '\n'; // 确保 host 小写

    const signedHeaders = 'content-type;host';

    // 对请求体进行排序 (JSON已排序)
    const payload = JSON.stringify(params);
    const hashedRequestPayload = await sha256(payload); // sha256 返回 hex string

    const canonicalRequest =
      httpRequestMethod + '\n' +
      canonicalUri + '\n' +
      canonicalQueryString + '\n' +
      canonicalHeaders + '\n' +
      signedHeaders + '\n' +
      hashedRequestPayload; // 使用 hex string

    // 2. 创建签名字符串
    const algorithm = 'TC3-HMAC-SHA256';
    const credentialScope =
      date + '/' +
      TENCENT_CLOUD_CONFIG.service + '/' +
      'tc3_request';

    const hashedCanonicalRequest = await sha256(canonicalRequest); // sha256 返回 hex string

    const stringToSign =
      algorithm + '\n' +
      timestamp + '\n' +
      credentialScope + '\n' +
      hashedCanonicalRequest; // 使用 hex string

    // 3. 计算签名
    // 密钥派生步骤，使用 hmacSha256Binary 获取原始字节
    const secretDateKey = 'TC3' + TENCENT_CLOUD_CONFIG.secretKey;
    const secretDate = await hmacSha256Binary(secretDateKey, date);
    log('派生密钥 - secretDate (binary):', secretDate); // 调试

    const secretService = await hmacSha256Binary(secretDate, TENCENT_CLOUD_CONFIG.service);
    log('派生密钥 - secretService (binary):', secretService); // 调试

    const secretSigning = await hmacSha256Binary(secretService, 'tc3_request');
    log('派生密钥 - secretSigning (binary):', secretSigning); // 调试


    // 最终签名，使用 hmacSha256Hex 获取十六进制结果
    const signature = await hmacSha256Hex(secretSigning, stringToSign);
    log('最终签名 (hex):', signature); // 调试


    // 4. 构造授权字符串
    const authorization =
      algorithm + ' ' +
      'Credential=' + TENCENT_CLOUD_CONFIG.secretId + '/' + credentialScope + ', ' +
      'SignedHeaders=' + signedHeaders + ', ' +
      'Signature=' + signature;

    log('API签名生成成功');

    return {
      authorization,
      timestamp,
      host: TENCENT_CLOUD_CONFIG.endpoint
    };
  } catch (error) {
    log('生成签名失败', error);
    // 抛出错误以便上层捕获
    throw new Error('生成API签名失败: ' + error.message);
  }
}

// 使用腾讯云API进行翻译
async function translateText(text, sourceLang = 'auto', targetLang = 'zh') {
  try {
    log(`翻译请求: ${sourceLang} -> ${targetLang}, 文本长度: ${text.length}`);
    
    // 如果文本为空，返回错误
    if (!text || text.trim() === '') {
      log('文本为空，无需翻译');
      return { error: '无文本可翻译' };
    }
    
    // 限制文本长度，腾讯云API对单次请求有大小限制
    if (text.length > 2000) {
      log('文本过长，截断处理');
      text = text.substring(0, 2000) + '...';
    }
    
    // 检查是否有缓存结果
    const cacheKey = `${text}|${sourceLang}|${targetLang}`;
    if (translationCache[cacheKey]) {
      log('使用缓存的翻译结果');
      return { translatedText: translationCache[cacheKey] };
    }
    
    // 加载API密钥
    await loadApiKeys();
    
    // 检查API密钥是否已设置
    if (!TENCENT_CLOUD_CONFIG.secretId || !TENCENT_CLOUD_CONFIG.secretKey) {
      log('API密钥未设置');
      // 考虑返回更明确的错误或抛出错误
      return { error: '请先在扩展设置中配置腾讯云API密钥' };
    }
    
    // 准备请求参数
    const params = {
      SourceText: text,
      Source: sourceLang,
      Target: targetLang,
      ProjectId: 0 // 确保ProjectId存在且为0
    };
    
    log('准备生成API签名');
    // 生成签名 (调用更新后的 generateSignature)
    const signatureInfo = await generateSignature(params);
    
    // 设置请求头
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': signatureInfo.authorization,
      'Host': signatureInfo.host, // 使用签名信息中返回的 host
      'X-TC-Action': TENCENT_CLOUD_CONFIG.action,
      'X-TC-Version': TENCENT_CLOUD_CONFIG.version,
      'X-TC-Timestamp': signatureInfo.timestamp.toString(), // 确保是字符串
      'X-TC-Region': TENCENT_CLOUD_CONFIG.region
    };
    
    // --- 保持之前的详细调试日志 ---
    log('--- 腾讯云API请求调试信息 ---');
    log('时间戳 (X-TC-Timestamp): ', signatureInfo.timestamp);
    log('计算出的日期 (for Credential): ', getDate(signatureInfo.timestamp * 1000));
    log('请求体 (params): ', JSON.stringify(params));
    log('主机 (Host Header): ', signatureInfo.host);
    log('区域 (X-TC-Region Header): ', TENCENT_CLOUD_CONFIG.region);
    log('操作 (X-TC-Action Header): ', TENCENT_CLOUD_CONFIG.action);
    log('版本 (X-TC-Version Header): ', TENCENT_CLOUD_CONFIG.version);
    log('完整授权头 (Authorization Header): ', signatureInfo.authorization);
    log('所有请求头 (All Headers): ', JSON.stringify(headers));
    log('--- 调试信息结束 ---');
    // --- 结束添加调试日志 ---

    log('发送翻译请求到腾讯云API');
    // 发送请求
    const response = await fetch(`https://${TENCENT_CLOUD_CONFIG.endpoint}`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(params) // 发送 stringified JSON
    });
    
    // 检查HTTP响应状态
    if (!response.ok) {
      log('HTTP请求失败', response.status, response.statusText);
      throw new Error(`HTTP请求失败: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // 处理响应
    if (result.Response && result.Response.TargetText) {
      log('翻译成功');
      // 缓存结果
      translationCache[cacheKey] = result.Response.TargetText;
      return { translatedText: result.Response.TargetText };
    } else if (result.Response && result.Response.Error) {
      log('API返回错误', result.Response.Error);
      throw new Error(result.Response.Error.Message || '翻译服务返回错误');
    } else {
      log('未知的API响应格式', result);
      throw new Error('未知的API响应格式');
    }
  } catch (error) {
      log('翻译过程出错 (translateText 顶层 catch)', error);
      // 确保返回或抛出错误
      return { error: error.message || '翻译请求失败' };
  }
}

// 扩展安装或更新时的处理
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    log('扩展已安装');
    // 弹出选项页面，引导用户设置API密钥
    chrome.runtime.openOptionsPage();
  } else if (details.reason === 'update') {
    log(`扩展已更新到版本 ${chrome.runtime.getManifest().version}`);
  }
});

// 当设置更新时清除缓存
function clearTranslationCache() {
  log('清除翻译缓存');
  Object.keys(translationCache).forEach(key => {
    delete translationCache[key];
  });
}

// 监听来自content脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  log('收到消息', request.action);
  
  if (request.action === 'translate') {
    // 异步处理翻译请求
    const sourceLang = request.sourceLang || 'auto';
    const targetLang = request.targetLang || 'zh';
    
    log(`处理翻译请求: ${sourceLang} -> ${targetLang}`);
    
    translateText(request.text, sourceLang, targetLang)
      .then(response => {
        log('发送翻译响应');
        sendResponse(response);
      })
      .catch(error => {
        log('翻译过程发生错误', error);
        sendResponse({ error: error.message || '翻译过程发生错误' });
      });
    
    // 返回true表示将使用异步方式发送响应
    return true;
  } else if (request.action === 'settingsUpdated') {
    // 当设置更新时，清除翻译缓存并重新加载API密钥
    log('设置已更新，重新加载API密钥');
    clearTranslationCache();
    loadApiKeys().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});
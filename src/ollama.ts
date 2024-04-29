export async function ollamaFetchStream(model: string, messages: { role: string, content: string }[], callback: (jsonLine: any) => void) {
  try {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: messages
      })
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const reader = response.body!.getReader(); // 创建一个读取器
    const decoder = new TextDecoder(); // 创建一个文本解码器

    const readStream = async () => {
      try {
        const { done, value } = await reader.read();
        if (done) {
          console.log('Stream finished');
          return;
        }

        const chunk = decoder.decode(value!, { stream: true }); // 解码当前块
        callback(JSON.parse(chunk)); // 调用回调函数处理当前行的 JSON 数据

        await readStream(); // 继续读取下一块
      } catch (error) {
        console.error('Error reading stream:', error);
      }
    };

    await readStream(); // 开始读取流
  } catch (error) {
    console.error('There was a problem with your fetch operation:', error);
  }
}

// 示例用法
// ollamaFetchStream('llama3', [{ role: 'user', content: 'why is the sky blue?' }], jsonLine => {
//   //{"model":"llama3","created_at":"2024-04-29T05:41:52.9845894Z","message":{"role":"assistant","content":" shorter"},"done":false}
//   console.log(jsonLine); // 在这里处理每一行的 JSON 数据
// });
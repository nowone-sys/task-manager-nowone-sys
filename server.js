const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- Supabase 初始化（凭据从环境变量读取，Vercel 上在 Environment Variables 配置）----
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// 统一检查：未配置环境变量时给出明确提示
function ensureDb(res) {
  if (!supabase) {
    res.status(500).json({ error: '数据库未配置：请在环境变量中设置 SUPABASE_URL 和 SUPABASE_ANON_KEY' });
    return false;
  }
  return true;
}

// ---- 查询任务（支持按优先级筛选，按创建时间倒序）----
app.get('/api/tasks', async (req, res) => {
  if (!ensureDb(res)) return;
  try {
    let query = supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    const { priority } = req.query;
    if (priority && priority !== '全部') {
      query = query.eq('priority', priority);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- 添加任务 ----
app.post('/api/tasks', async (req, res) => {
  if (!ensureDb(res)) return;
  try {
    const { title, priority } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: '任务标题不能为空' });
    }
    const validPriority = ['高', '中', '低'];
    const p = validPriority.includes(priority) ? priority : '中';

    const { data, error } = await supabase
      .from('tasks')
      .insert({ title: title.trim(), priority: p })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- 切换完成状态 ----
app.patch('/api/tasks/:id', async (req, res) => {
  if (!ensureDb(res)) return;
  try {
    const { completed } = req.body;
    const { data, error } = await supabase
      .from('tasks')
      .update({ completed: !!completed })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- 删除任务 ----
app.delete('/api/tasks/:id', async (req, res) => {
  if (!ensureDb(res)) return;
  try {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Vercel Serverless 兼容：导出 app，仅在直接运行时监听端口
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`服务器已启动：http://localhost:${PORT}`);
  });
}

module.exports = app;

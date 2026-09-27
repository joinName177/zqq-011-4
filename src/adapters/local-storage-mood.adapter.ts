import { MoodRecord } from '../core/models';
import { MoodRepositoryPort } from '../ports/mood-repository.port';
import { createRecordFromTag, isValidMoodRecord, toLocalDateStr } from '../core/meteorology-engine';

const STORAGE_KEY = 'mood_meteorology_records_v1';

export class LocalStorageMoodAdapter implements MoodRepositoryPort {
  /**
   * 读取全部记录，三种存储状态分别处理：
   * - 从未写入（无 key）：首次使用，播种内置 14 天示例序列；
   * - 内容损坏（非法 JSON / 非数组 / 全部记录无效）：恢复示例序列，保证界面可用；
   * - 合法数组（含显式空数组）：过滤无效条目后原样返回，空数组交由 UI 展示空状态。
   */
  getAll(): MoodRecord[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return this.resetToSample();
    }
    const parsed = this.parseStored(raw);
    if (parsed === null) {
      return this.resetToSample();
    }
    return parsed;
  }

  /**
   * 解析存储内容。返回 null 表示数据损坏需要恢复；
   * 返回数组（可能为空）表示可安全使用的有效记录。
   */
  private parseStored(raw: string): MoodRecord[] | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!Array.isArray(parsed)) {
      return null;
    }
    const valid = parsed.filter(isValidMoodRecord);
    // 有内容但全部无效，等同数据损坏
    if (parsed.length > 0 && valid.length === 0) {
      return null;
    }
    return valid;
  }

  /** 读取原始存储（不触发示例播种/恢复），供写入操作使用。 */
  private readStoredRaw(): MoodRecord[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return [];
    }
    return this.parseStored(raw) ?? [];
  }

  private save(records: MoodRecord[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  add(record: MoodRecord): void {
    // 基于真实存储内容追加，空存储时从空白序列开始，绝不静默混入示例数据
    const records = this.readStoredRaw().filter(r => r.date !== record.date);
    records.push(record);
    this.save(records);
  }

  delete(id: string): void {
    const records = this.readStoredRaw().filter(r => r.id !== id);
    this.save(records);
  }

  resetToSample(): MoodRecord[] {
    const sampleSequence: { tag: string; intensity: number; note: string; daysAgo: number }[] = [
      { tag: '晴空万里', intensity: 8, note: '项目顺利交付，周末在公园草坪晒太阳看书', daysAgo: 13 },
      { tag: '微风煦暖', intensity: 7, note: '和久违的老朋友喝咖啡，聊得很尽兴', daysAgo: 12 },
      { tag: '阴转多云', intensity: 5, note: '周一早会任务排得很满，平平淡淡地推进中', daysAgo: 11 },
      { tag: '暖湿气流过境', intensity: 6, note: '收到远方朋友的明信片与礼物，心里暖融融的', daysAgo: 10 },
      { tag: '低气压大雾', intensity: 4, note: '下雨天有点没精神，工作效率稍显迟缓', daysAgo: 9 },
      { tag: '局部有焦虑', intensity: 7, note: '季度目标对齐会议，几个指标有点卡住', daysAgo: 8 },
      { tag: '局部有焦虑', intensity: 8, note: '晚上失眠胡思乱想，担心后续进展', daysAgo: 7 },
      { tag: '突发雷暴', intensity: 9, note: '需求突然变更被要求大改，情绪瞬间崩溃爆发', daysAgo: 6 },
      { tag: '暖湿气流过境', intensity: 6, note: '同组成员主动分担了工作，并送了奶茶安慰', daysAgo: 5 },
      { tag: '阴转多云', intensity: 5, note: '调整心态，逐步把阻塞的问题拆解解决', daysAgo: 4 },
      { tag: '微风煦暖', intensity: 7, note: '晚风很舒服，去河边慢跑了5公里出了一身汗', daysAgo: 3 },
      { tag: '晴空万里', intensity: 8, note: '所有模块测试通过，终于可以松一口气', daysAgo: 2 },
      { tag: '微风煦暖', intensity: 7, note: '睡到自然醒，给阳台的多肉植物浇水修叶', daysAgo: 1 },
      { tag: '局部有焦虑', intensity: 7, note: '新的一周即将到来，局部依然盘旋着对未知的轻度担忧', daysAgo: 0 }
    ];

    const now = new Date();
    const records: MoodRecord[] = sampleSequence.map(item => {
      const d = new Date(now.getTime() - item.daysAgo * 86400000);
      const dateStr = toLocalDateStr(d);
      return createRecordFromTag(item.tag, item.intensity, item.note, dateStr);
    });

    this.save(records);
    return records;
  }
}

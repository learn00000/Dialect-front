export const DIALECT_GROUPS = [
  {
    key: 'guanhua',
    label: '官话方言',
    subgroups: ['东北官话', '北京官话', '冀鲁官话', '胶辽官话', '中原官话', '兰银官话', '江淮官话', '西南官话']
  },
  {
    key: 'jin',
    label: '晋方言',
    subgroups: ['并州片', '吕梁片', '上党片', '五台片', '张呼片', '邯新片', '志延片']
  },
  {
    key: 'wu',
    label: '吴方言',
    subgroups: ['太湖片', '台州片', '温州片', '婺州片', '处衢片', '宣州片', '瓯江片']
  },
  {
    key: 'min',
    label: '闽方言',
    subgroups: ['闽东片', '闽南片', '闽北片', '闽中片', '莆仙片', '邵将片', '琼文片']
  },
  {
    key: 'hakka',
    label: '客家方言',
    subgroups: ['梅惠片', '海陆片', '汀州片', '粤台片', '赣南片']
  },
  {
    key: 'yue',
    label: '粤方言',
    subgroups: ['广府片', '四邑片', '高阳片', '勾漏片', '吴化片', '邕浔片']
  },
  {
    key: 'xiang',
    label: '湘方言',
    subgroups: ['长益片', '娄邵片', '辰溆片', '衡州片', '永全片']
  },
  {
    key: 'gan',
    label: '赣方言',
    subgroups: ['昌都片', '宜浏片', '吉茶片', '抚广片', '鹰弋片', '大通片']
  },
  {
    key: 'hui',
    label: '徽方言',
    subgroups: ['绩歙片', '休黟片', '祁德片', '严州片', '旌占片']
  },
  {
    key: 'pinghua_tuhua',
    label: '平话土话',
    subgroups: ['桂南平话', '桂北平话', '湘南土话', '粤北土话']
  }
]

export function getDialectGroupOptions() {
  return DIALECT_GROUPS
}

export function getDialectSubgroups(groupLabel) {
  return DIALECT_GROUPS.find((item) => item.label === groupLabel)?.subgroups || []
}

export function buildDialectLabel(groupLabel, subgroupLabel, customLabel = '') {
  const custom = String(customLabel || '').trim()
  const parts = [groupLabel, subgroupLabel, custom].filter(Boolean)
  return parts.join(' / ')
}

const FULLY_SUPPORTED_GROUPS = new Set(['官话方言', '晋方言', '吴方言', '客家方言', '粤方言', '湘方言', '赣方言'])
const CONDITIONALLY_SUPPORTED_SUBGROUPS = new Set(['闽南片'])

export function getDialectSupportPolicy(groupLabel, subgroupLabel) {
  const group = String(groupLabel || '').trim()
  const subgroup = String(subgroupLabel || '').trim()

  if (!group || !subgroup) {
    return {
      asrSupported: true,
      requiresManualTranscript: false,
      note: '请选择方言大区与次方言后查看识别策略。'
    }
  }

  if (FULLY_SUPPORTED_GROUPS.has(group)) {
    return {
      asrSupported: true,
      requiresManualTranscript: false,
      note: '当前所选方言在 Fun-ASR 官方明确支持范围内，可选填录音文字版。'
    }
  }

  if (group === '闽方言' && CONDITIONALLY_SUPPORTED_SUBGROUPS.has(subgroup)) {
    return {
      asrSupported: true,
      requiresManualTranscript: false,
      note: '当前仅闽南片在 Fun-ASR 官方明确支持范围内，可选填录音文字版。'
    }
  }

  return {
    asrSupported: false,
    requiresManualTranscript: true,
    note: '当前所选次方言不在 Fun-ASR 官方明确支持名单中，必须填写录音文字版后才能上传。'
  }
}

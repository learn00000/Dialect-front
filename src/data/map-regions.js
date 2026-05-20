/**
 * 声绘山河 · 省市区数据（侧栏筛选与上传表单共用）
 * 坐标为 GCJ-02，区县级在市中心基础上做小幅偏移以便区分相邻标点
 */

/** @type {{ name: string, cities: { name: string, districts: string[] }[] }[]} */
export const MAP_REGION_TREE = [
  {
    name: '北京市',
    cities: [{ name: '北京市', districts: ['东城区', '西城区', '朝阳区', '海淀区', '丰台区', '石景山区'] }]
  },
  {
    name: '天津市',
    cities: [{ name: '天津市', districts: ['和平区', '河东区', '河西区', '南开区', '滨海新区'] }]
  },
  {
    name: '上海市',
    cities: [{ name: '上海市', districts: ['黄浦区', '徐汇区', '长宁区', '静安区', '浦东新区', '虹口区'] }]
  },
  {
    name: '重庆市',
    cities: [{ name: '重庆市', districts: ['渝中区', '江北区', '南岸区', '沙坪坝区', '九龙坡区'] }]
  },
  {
    name: '河北省',
    cities: [
      { name: '石家庄市', districts: ['长安区', '桥西区', '裕华区'] },
      { name: '唐山市', districts: ['路北区', '路南区', '曹妃甸区'] }
    ]
  },
  {
    name: '山西省',
    cities: [
      { name: '太原市', districts: ['小店区', '迎泽区', '杏花岭区'] },
      { name: '大同市', districts: ['平城区', '云冈区'] }
    ]
  },
  {
    name: '辽宁省',
    cities: [
      { name: '沈阳市', districts: ['和平区', '沈河区', '皇姑区'] },
      { name: '大连市', districts: ['中山区', '西岗区', '沙河口区'] }
    ]
  },
  {
    name: '吉林省',
    cities: [{ name: '长春市', districts: ['南关区', '朝阳区', '绿园区'] }]
  },
  {
    name: '黑龙江省',
    cities: [{ name: '哈尔滨市', districts: ['道里区', '南岗区', '香坊区'] }]
  },
  {
    name: '江苏省',
    cities: [
      { name: '南京市', districts: ['玄武区', '秦淮区', '鼓楼区'] },
      { name: '苏州市', districts: ['姑苏区', '虎丘区', '吴中区', '相城区'] },
      { name: '无锡市', districts: ['梁溪区', '滨湖区'] }
    ]
  },
  {
    name: '浙江省',
    cities: [
      { name: '杭州市', districts: ['上城区', '拱墅区', '西湖区', '滨江区', '余杭区', '萧山区'] },
      { name: '宁波市', districts: ['海曙区', '江北区', '鄞州区', '镇海区'] },
      { name: '温州市', districts: ['鹿城区', '龙湾区', '瓯海区'] }
    ]
  },
  {
    name: '安徽省',
    cities: [
      { name: '合肥市', districts: ['瑶海区', '庐阳区', '蜀山区'] },
      { name: '芜湖市', districts: ['镜湖区', '弋江区'] }
    ]
  },
  {
    name: '福建省',
    cities: [
      { name: '福州市', districts: ['鼓楼区', '台江区', '仓山区'] },
      { name: '厦门市', districts: ['思明区', '湖里区', '集美区'] },
      { name: '泉州市', districts: ['鲤城区', '丰泽区'] }
    ]
  },
  {
    name: '江西省',
    cities: [{ name: '南昌市', districts: ['东湖区', '西湖区', '红谷滩区'] }]
  },
  {
    name: '山东省',
    cities: [
      { name: '济南市', districts: ['历下区', '市中区', '槐荫区'] },
      { name: '青岛市', districts: ['市南区', '市北区', '崂山区'] }
    ]
  },
  {
    name: '河南省',
    cities: [
      { name: '郑州市', districts: ['中原区', '二七区', '金水区'] },
      { name: '洛阳市', districts: ['老城区', '西工区', '洛龙区'] }
    ]
  },
  {
    name: '湖北省',
    cities: [
      { name: '武汉市', districts: ['江岸区', '江汉区', '武昌区', '洪山区'] },
      { name: '宜昌市', districts: ['西陵区', '伍家岗区'] }
    ]
  },
  {
    name: '湖南省',
    cities: [
      { name: '长沙市', districts: ['芙蓉区', '天心区', '岳麓区'] },
      { name: '岳阳市', districts: ['岳阳楼区', '云溪区'] }
    ]
  },
  {
    name: '广东省',
    cities: [
      { name: '广州市', districts: ['越秀区', '荔湾区', '天河区', '海珠区', '白云区'] },
      { name: '深圳市', districts: ['福田区', '南山区', '罗湖区', '宝安区'] },
      { name: '佛山市', districts: ['禅城区', '南海区'] }
    ]
  },
  {
    name: '海南省',
    cities: [{ name: '海口市', districts: ['秀英区', '龙华区', '美兰区'] }]
  },
  {
    name: '四川省',
    cities: [
      { name: '成都市', districts: ['锦江区', '青羊区', '武侯区', '成华区', '高新区'] },
      { name: '绵阳市', districts: ['涪城区', '游仙区'] }
    ]
  },
  {
    name: '贵州省',
    cities: [{ name: '贵阳市', districts: ['南明区', '云岩区', '观山湖区'] }]
  },
  {
    name: '云南省',
    cities: [{ name: '昆明市', districts: ['五华区', '盘龙区', '官渡区'] }]
  },
  {
    name: '陕西省',
    cities: [{ name: '西安市', districts: ['新城区', '碑林区', '雁塔区', '未央区'] }]
  },
  {
    name: '甘肃省',
    cities: [{ name: '兰州市', districts: ['城关区', '七里河区', '安宁区'] }]
  },
  {
    name: '青海省',
    cities: [{ name: '西宁市', districts: ['城东区', '城中区', '城西区'] }]
  },
  {
    name: '台湾省',
    cities: [{ name: '台北市', districts: ['中正区', '大安区', '信义区'] }]
  },
  {
    name: '内蒙古自治区',
    cities: [{ name: '呼和浩特市', districts: ['新城区', '回民区', '赛罕区'] }]
  },
  {
    name: '广西壮族自治区',
    cities: [
      { name: '南宁市', districts: ['兴宁区', '青秀区', '西乡塘区'] },
      { name: '桂林市', districts: ['秀峰区', '叠彩区'] }
    ]
  },
  {
    name: '西藏自治区',
    cities: [{ name: '拉萨市', districts: ['城关区', '堆龙德庆区'] }]
  },
  {
    name: '宁夏回族自治区',
    cities: [{ name: '银川市', districts: ['兴庆区', '西夏区', '金凤区'] }]
  },
  {
    name: '新疆维吾尔自治区',
    cities: [{ name: '乌鲁木齐市', districts: ['天山区', '沙依巴克区', '水磨沟区'] }]
  },
  {
    name: '香港特别行政区',
    cities: [{ name: '香港特别行政区', districts: ['中西区', '湾仔区', '九龙城区'] }]
  },
  {
    name: '澳门特别行政区',
    cities: [{ name: '澳门特别行政区', districts: ['花地玛堂区', '圣安多尼堂区'] }]
  }
]

/** 市级中心坐标（GCJ-02） */
const CITY_CENTERS = {
  '北京市/北京市': [116.397428, 39.90923],
  '天津市/天津市': [117.201509, 39.085318],
  '上海市/上海市': [121.473701, 31.230416],
  '重庆市/重庆市': [106.551556, 29.563009],
  '河北省/石家庄市': [114.514976, 38.042306],
  '河北省/唐山市': [118.180193, 39.630867],
  '山西省/太原市': [112.549248, 37.857014],
  '山西省/大同市': [113.300127, 40.076762],
  '辽宁省/沈阳市': [123.431474, 41.805698],
  '辽宁省/大连市': [121.614682, 38.914003],
  '吉林省/长春市': [125.323544, 43.817071],
  '黑龙江省/哈尔滨市': [126.534967, 45.803775],
  '江苏省/南京市': [118.796877, 32.060255],
  '江苏省/苏州市': [120.585315, 31.298886],
  '江苏省/无锡市': [120.31191, 31.491169],
  '浙江省/杭州市': [120.153576, 30.287459],
  '浙江省/宁波市': [121.550357, 29.874556],
  '浙江省/温州市': [120.699367, 27.993828],
  '安徽省/合肥市': [117.227239, 31.820586],
  '安徽省/芜湖市': [118.432941, 31.352859],
  '福建省/福州市': [119.296494, 26.074507],
  '福建省/厦门市': [118.089425, 24.479834],
  '福建省/泉州市': [118.675676, 24.874132],
  '江西省/南昌市': [115.858197, 28.682892],
  '山东省/济南市': [117.120098, 36.651216],
  '山东省/青岛市': [120.382639, 36.067082],
  '河南省/郑州市': [113.625368, 34.746599],
  '河南省/洛阳市': [112.45404, 34.619682],
  '湖北省/武汉市': [114.305393, 30.593099],
  '湖北省/宜昌市': [111.286471, 30.691967],
  '湖南省/长沙市': [112.938814, 28.228209],
  '湖南省/岳阳市': [113.128958, 29.357104],
  '广东省/广州市': [113.264385, 23.129112],
  '广东省/深圳市': [114.057868, 22.543099],
  '广东省/佛山市': [113.121416, 23.021548],
  '海南省/海口市': [110.198293, 20.044001],
  '四川省/成都市': [104.065735, 30.659462],
  '四川省/绵阳市': [104.679114, 31.46745],
  '贵州省/贵阳市': [106.630153, 26.647661],
  '云南省/昆明市': [102.832891, 24.880095],
  '陕西省/西安市': [108.940174, 34.341568],
  '甘肃省/兰州市': [103.834303, 36.061089],
  '青海省/西宁市': [101.778228, 36.617144],
  '台湾省/台北市': [121.565418, 25.032969],
  '内蒙古自治区/呼和浩特市': [111.74918, 40.842585],
  '广西壮族自治区/南宁市': [108.366543, 22.817002],
  '广西壮族自治区/桂林市': [110.290194, 25.273566],
  '西藏自治区/拉萨市': [91.1145, 29.64415],
  '宁夏回族自治区/银川市': [106.230909, 38.487193],
  '新疆维吾尔自治区/乌鲁木齐市': [87.616848, 43.825592],
  '香港特别行政区/香港特别行政区': [114.169361, 22.319343],
  '澳门特别行政区/澳门特别行政区': [113.543873, 22.198745]
}

/** 与地图 Mock 点位精确对齐的区县坐标 */
const DISTRICT_PRECISE = {
  '浙江省/杭州市/西湖区': [120.153576, 30.287459],
  '上海市/上海市/黄浦区': [121.473701, 31.230416],
  '北京市/北京市/东城区': [116.397428, 39.90923],
  '广东省/广州市/越秀区': [113.264385, 23.129112],
  '四川省/成都市/锦江区': [104.065735, 30.659462],
  '江苏省/苏州市/姑苏区': [120.585315, 31.298886]
}

function districtOffset(district) {
  let h = 0
  for (let i = 0; i < district.length; i++) h = (h * 31 + district.charCodeAt(i)) | 0
  const a = ((h & 0xffff) / 0xffff - 0.5) * 0.08
  const b = (((h >> 16) & 0xffff) / 0xffff - 0.5) * 0.06
  return [a, b]
}

/**
 * @param {string} province
 * @param {string} city
 * @param {string} district
 * @returns {{ lng: number, lat: number }}
 */
export function getAreaLocation(province, city, district) {
  const area = `${province}/${city}/${district}`
  if (DISTRICT_PRECISE[area]) {
    const [lng, lat] = DISTRICT_PRECISE[area]
    return { lng, lat }
  }
  const cityKey = `${province}/${city}`
  const center = CITY_CENTERS[cityKey]
  if (center) {
    const [dlng, dlat] = districtOffset(district || '')
    return { lng: center[0] + dlng, lat: center[1] + dlat }
  }
  const provKey = `${province}/${province}`
  const provCenter = CITY_CENTERS[provKey]
  if (provCenter) {
    return { lng: provCenter[0], lat: provCenter[1] }
  }
  return { lng: 105.5, lat: 35.5 }
}

/**
 * @param {string} area 省/市/区县
 */
export function getLocationByAreaString(area) {
  const parts = String(area || '').split('/').filter(Boolean)
  if (parts.length >= 3) return getAreaLocation(parts[0], parts[1], parts[2])
  if (parts.length === 2) return getAreaLocation(parts[0], parts[1], parts[1])
  if (parts.length === 1) return getAreaLocation(parts[0], parts[0], parts[0])
  return { lng: 105.5, lat: 35.5 }
}

export function buildAreaString(province, city, district) {
  return `${province}/${city}/${district}`
}

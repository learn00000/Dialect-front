/** 方音拾级 · 各关卡题目（Mock / 开发用） */

const S1_AUDIO_MEANING = './video-study/001/听音辨义.m4a'
const S1_REPEAT_AUDIO = './video-study/001/跟读语音.m4a'
const S2_AUDIO_MEANING = './video-study/002/听音辨义.m4a'
const S2_REPEAT_AUDIO = './video-study/002/跟读语音.m4a'

export const STAGE_QUESTIONS = {
  s1: [
    {
      id: 's1-q1',
      type: 'audioMeaning',
      audioUrl: S1_AUDIO_MEANING,
      options: [
        'A. 祝你一路顺风',
        'B. 这东西你还用吗',
        'C. 好像要下雨了',
        'D. 我去把桌子擦一下'
      ],
      correctIndex: 0
    },
    {
      id: 's1-q2',
      type: 'repeatScore',
      sentence: '有时间再见',
      referenceAudioUrl: S1_REPEAT_AUDIO,
      passScore: 60
    },
    {
      id: 's1-q3',
      type: 'idiomMeaning',
      stem: '以下哪个方言词语的释义是正确的？',
      options: [
        'A. 天光：早饭',
        'B. 眼睛架子：眼镜框',
        'C. 后半日：晚上',
        'D. 里长人：新生儿'
      ],
      correctIndex: 0,
      hintWrong: {
        1: '「眼睛架子」指戴眼镜的人，不是眼镜框。',
        2: '「后半日」指下午，不是晚上。',
        3: '「里长人」指儿媳妇，不是新生儿。'
      }
    }
  ],
  s2: [
    {
      id: 's2-q1',
      type: 'audioMeaning',
      audioUrl: S2_AUDIO_MEANING,
      options: [
        'A. 我没有办法',
        'B. 我在讲白话',
        'C. 谁得到了白桦叶',
        'D. 我今天特别开心'
      ],
      correctIndex: 3
    },
    {
      id: 's2-q2',
      type: 'repeatScore',
      sentence: '我的专业是计算机',
      referenceAudioUrl: S2_REPEAT_AUDIO,
      passScore: 60
    },
    {
      id: 's2-q3',
      type: 'idiomMeaning',
      stem: '以下哪个闽南话词语的释义是正确的？',
      options: [
        'A. 娘仔：妈宝男',
        'B. 雪文：公章',
        'C. 秋秋累：羞羞脸',
        'D. 照纪纲：学生'
      ],
      correctIndex: 2,
      hintWrong: {
        0: '「娘仔」指闺秀、小姐，不是妈宝男。',
        1: '「雪文」是肥皂，不是公章。',
        3: '「照纪纲」是照理的意思，不是学生。'
      }
    }
  ]
}

function defaultStageQuestions(stageId) {
  return STAGE_QUESTIONS.s1.map((q) => ({
    ...q,
    id: q.id.replace(/^s1-/, `${stageId}-`)
  }))
}

export function getStageQuestions(stageId) {
  return STAGE_QUESTIONS[stageId] ? STAGE_QUESTIONS[stageId] : defaultStageQuestions(stageId)
}

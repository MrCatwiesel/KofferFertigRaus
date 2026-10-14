/** Hilfe und Einführung in der Sprache der App */
import { lang } from '../i18n'
import { HELP_GROUPS, HELP_TOPICS, INTRO_SLIDES, type HelpTopic, type IntroSlide } from './inhalt'
import { HELP_GROUPS_EN, HELP_TOPICS_EN, INTRO_SLIDES_EN } from './inhalt-en'

export function helpTopics(): HelpTopic[] {
  if (lang.value !== 'en') return HELP_TOPICS
  return HELP_TOPICS.map((t) => {
    const en = HELP_TOPICS_EN[t.id]
    if (!en) return t
    return {
      ...t,
      group: HELP_GROUPS_EN[t.group] ?? t.group,
      title: en.title,
      keywords: `${en.keywords ?? ''} ${t.keywords ?? ''}`,
      text: en.text,
      steps: en.steps ?? t.steps,
      links: t.links?.map((l, i) => ({ ...l, label: en.links?.[i] ?? l.label }))
    }
  })
}

export const helpGroups = (): string[] => (lang.value === 'en' ? HELP_GROUPS.map((g) => HELP_GROUPS_EN[g] ?? g) : HELP_GROUPS)

export const introSlides = (): IntroSlide[] => (lang.value === 'en' ? INTRO_SLIDES_EN : INTRO_SLIDES)

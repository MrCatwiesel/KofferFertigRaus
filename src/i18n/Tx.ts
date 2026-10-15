import { Fragment, defineComponent, h, type PropType } from 'vue'
import { t, type Params } from './index'

/**
 * Satz mit eingebetteten Elementen (Link, Code, Fettdruck) – als ein Text übersetzbar,
 * damit jede Sprache ihre eigene Wortstellung hat:
 *
 *   <Tx text="Zuerst den {link} einrichten."><template #link><RouterLink to="/abgleich">…</RouterLink></template></Tx>
 *
 * Platzhalter ohne passenden Slot werden aus `params` gefüllt (wie bei `t`).
 */
export default defineComponent({
  name: 'Tx',
  props: {
    text: { type: String, required: true },
    params: { type: Object as PropType<Params>, default: undefined }
  },
  setup(props, { slots }) {
    return () =>
      h(
        Fragment,
        null,
        t(props.text, props.params)
          .split(/(\{\w+\})/)
          .filter(Boolean)
          .map((part) => {
            const slot = /^\{(\w+)\}$/.exec(part)?.[1]
            return slot && slots[slot] ? slots[slot]!() : part
          })
      )
  }
})

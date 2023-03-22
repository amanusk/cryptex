import { AlertDialog } from "@argent/ui"
import { ComponentMeta, ComponentStory } from "@storybook/react"

export default {
  title: "components/AlertDialog",
  component: AlertDialog,
} as ComponentMeta<typeof AlertDialog>

const onCancel = () => console.log("onCancel")
const onDestroy = () => console.log("onDestroy")
const onConfirm = () => console.log("onConfirm")

const Template: ComponentStory<typeof AlertDialog> = (props) => {
  return <AlertDialog {...props} isOpen onCancel={onCancel}></AlertDialog>
}

export const Cancel = Template.bind({})
Cancel.args = {
  title: "Lorem ipsum",
  message:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lectus nisl, diam iaculis porttitor.",
}

export const OK = Template.bind({})
OK.args = {
  title: "Lorem ipsum",
  message:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lectus nisl, diam iaculis porttitor.",
  cancelTitle: "OK",
}

export const Allow = Template.bind({})
Allow.args = {
  title: "Lorem ipsum",
  message:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lectus nisl, diam iaculis porttitor.",
  cancelTitle: "Don’t allow",
  confirmTitle: "Allow",
  onConfirm,
}

export const Destructive = Template.bind({})
Destructive.args = {
  title: "Remove contact",
  message:
    "Are you sure you want to remove this contact from your address book?",
  destroyTitle: "Remove",
  onDestroy,
}

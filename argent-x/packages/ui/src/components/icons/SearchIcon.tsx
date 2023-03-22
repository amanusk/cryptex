import { chakra } from "@chakra-ui/react"
import { SVGProps } from "react"
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.875 1.875a9 9 0 1 0 5.519 16.11l3.81 3.81a1.125 1.125 0 0 0 1.591-1.59l-3.81-3.811a9 9 0 0 0-7.11-14.519Zm-6.75 9a6.75 6.75 0 1 1 13.5 0 6.75 6.75 0 0 1-13.5 0Z"
      fill="currentColor"
    />
  </svg>
)
export default chakra(SvgComponent)

import { Avatar } from "@radix-ui/themes";
import { useMemo } from "react";
import { Style, Avatar as DiceBearAvatar } from '@dicebear/core';
import identicon from '@dicebear/styles/identicon.json';

const cache: Record<string, string> = { };

export default function AddressAvatar(props: { address: string } & Record<string, any>) {
  const src = useMemo(() => {
    let result = cache[props.address];
    if (!result) {
      result = cache[props.address] = new DiceBearAvatar(new Style(identicon), {
        seed: props.address
      }).toDataUri();
    }
    return result;
  }, [props.address]);
  return (
    <Avatar fallback={props.address.substring(props.address.length - 2)} radius="large" src={src} {...props}></Avatar>    
  )
}
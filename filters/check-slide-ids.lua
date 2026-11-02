-- Warn about untitled slides. Their automatic identifiers ("section",
-- "section-1", ...) depend on how many untitled headings come before them,
-- and saved drawings are keyed by slide identifier, so inserting an untitled
-- slide earlier in the deck would move drawings onto the wrong slide.

function Header(header)
  if header.level <= 2
    and #header.content == 0
    and header.identifier:match("^section%-?%d*$")
  then
    io.stderr:write(
      "[warning] untitled slide has automatic id '" .. header.identifier
        .. "'; give it an explicit one, e.g. ## {#board-volume .chalk}\n"
    )
  end
end

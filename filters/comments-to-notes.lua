-- HTML comments in Markdown become speaker notes on the containing slide.
-- Collect notes outside their containing blocks so comments inside lists
-- don't become part of the audience-facing list or its fragments.

local function comment_contents(text)
  local contents = {}
  while not text:match("^%s*$") do
    local content, rest = text:match("^%s*<!%-%-(.-)%-%->(.*)$")
    if not content then return nil end
    contents[#contents + 1] = content
    text = rest
  end
  if #contents > 0 then return contents end
end

function Pandoc(document)
  local blocks = pandoc.List()
  for _, block in ipairs(document.blocks) do
    local notes = pandoc.List()
    local function extract(raw)
      if raw.format ~= "html" then return nil end
      local contents = comment_contents(raw.text)
      if not contents then return nil end
      for _, content in ipairs(contents) do
        for _, note in ipairs(pandoc.read(content, "markdown").blocks) do
          notes:insert(note)
        end
      end
      return {}
    end

    local converted = pandoc.Pandoc({ block }):walk({
      traverse = "topdown",
      Div = function(div)
        -- Explicit notes already have the right destination.
        if div.classes:includes("notes") then return div, false end
      end,
      RawBlock = extract,
      RawInline = extract,
    })
    blocks:extend(converted.blocks)
    if #notes > 0 then
      blocks:insert(pandoc.Div(notes, pandoc.Attr("", { "notes" })))
    end
  end
  document.blocks = blocks
  return document
end

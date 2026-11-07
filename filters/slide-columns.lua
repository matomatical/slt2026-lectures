-- On .sidebar and .split slides, a top-level horizontal rule divides columns.

function Pandoc(document)
  local result = pandoc.List()
  local heading = nil
  local layout = nil
  local content = pandoc.List()

  local function finish_slide()
    if not layout then return end
    local left, right, notes = pandoc.List(), pandoc.List(), pandoc.List()
    local divided = false
    local function invalid(message)
      error("Column slide '" .. heading.identifier .. "': " .. message, 0)
    end
    for _, block in ipairs(content) do
      if block.t == "HorizontalRule" then
        if divided then invalid("use exactly one --- column divider") end
        divided = true
      elseif block.t == "Div" and block.classes:includes("notes") then
        notes:insert(block)
      elseif divided then
        right:insert(block)
      else
        left:insert(block)
      end
    end
    if not divided then invalid("add a --- divider between the columns") end
    result:insert(pandoc.Div({
      pandoc.Div(left, pandoc.Attr("", { "column" })),
      pandoc.Div(right, pandoc.Attr("", { "column" })),
    }, pandoc.Attr("", { "columns", layout })))
    result:extend(notes)
    content = pandoc.List()
    layout = nil
  end

  for _, block in ipairs(document.blocks) do
    if block.t == "Header" and block.level <= 2 then
      finish_slide()
      heading = block
      if block.level == 2 then
        local sidebar = block.classes:includes("sidebar")
        local split = block.classes:includes("split")
        if sidebar and split then
          error("Column slide '" .. block.identifier .. "': choose .sidebar or .split", 0)
        end
        if sidebar then layout = "sidebar" end
        if split then layout = "split" end
      end
      result:insert(block)
    elseif layout then
      content:insert(block)
    else
      result:insert(block)
    end
  end
  finish_slide()
  document.blocks = result
  return document
end
